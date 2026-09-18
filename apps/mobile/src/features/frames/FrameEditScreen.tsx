/**
 * The frame edit screen – core scenario step 4 of the spec (§2.1).
 *
 * The screen is a thin composition over the domain rules: the edited frame lives in local state,
 * every change recomputes `validateFrame`, and only pressing "save" writes it to the store. Which
 * exposure fields are offered follows the exposure mode, the option lists follow the mounted
 * lens and the camera preset (see frameForm.ts).
 */
import type {
  AfResult,
  Camera,
  DriveMode,
  ExposureMode,
  FlashHead,
  FocusMode,
  Frame,
  FrameContext,
  Id,
  ISODateTime,
  Roll,
  ShutterSpeed,
  Support,
} from '@filmnotes/domain';
import {
  apertureValuesForLens,
  newFrame,
  nextFrameNo,
  shutterSpeedsForMode,
  validateFrame,
} from '@filmnotes/domain';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { confirmDestructive } from '../../lib/confirm';
import { now } from '../../lib/clock';
import { useActive, useEntity } from '../../store/hooks';
import { selectFramesForRoll } from '../../store/selectors';
import { useStore } from '../../store/store';
import {
  Button,
  EmptyState,
  IssueList,
  MultiSelectField,
  NumberField,
  Screen,
  Section,
  SelectField,
  SwitchField,
  TextField,
  useTheme,
  type SelectOption,
} from '../../ui';
import { FRAMES_NAMESPACE } from './i18n';
import {
  LIGHT_OPTIONS,
  SUBJECT_OPTIONS,
  applyLensChange,
  editableFields,
  filterOptions,
  focalLengthOptions,
} from './frameForm';
import { useLocation } from './useLocation';

/** AF feedback the Minolta gives through its viewfinder lamp. */
const AF_RESULTS: AfResult[] = ['green', 'red_blink', 'manual'];
/** How the camera was held – the input of the camera-shake rule. */
const SUPPORTS: Support[] = ['handheld', 'braced', 'tripod', 'beanbag'];

const DATE_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

/**
 * `takenAt` split into the two fields the photographer edits. Both are read and written in UTC,
 * because that is how the record stores them – no hidden timezone shift on a round trip.
 */
function splitTakenAt(takenAt: ISODateTime | null): { date: string; time: string } {
  if (takenAt === null) return { date: '', time: '' };
  const parsed = new Date(takenAt);
  if (Number.isNaN(parsed.getTime())) return { date: '', time: '' };
  const iso = parsed.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

/** The two fields back into an ISO timestamp; an unparsable date means "no time recorded". */
function joinTakenAt(date: string, time: string): ISODateTime | null {
  const day = DATE_PATTERN.exec(date.trim());
  if (day === null) return null;
  const clock = TIME_PATTERN.exec(time.trim());
  const stamp = Date.UTC(
    Number(day[1]),
    Number(day[2]) - 1,
    Number(day[3]),
    clock === null ? 0 : Number(clock[1]),
    clock === null ? 0 : Number(clock[2]),
  );
  return Number.isNaN(stamp) ? null : new Date(stamp).toISOString();
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Resolves the route parameter and the records the editor needs. The editor itself is keyed by
 * the frame id so that navigating to the next frame starts with fresh local state.
 */
export function FrameEditScreen() {
  const { t } = useTranslation(FRAMES_NAMESPACE);
  const { frameId } = useLocalSearchParams<{ frameId?: string }>();
  const frame = useEntity('frames', frameId ?? null);
  const roll = useEntity('rolls', frame?.rollId ?? null);
  const camera = useEntity('cameras', roll?.cameraId ?? null);

  if (frame === undefined || frame.deleted !== null || roll === undefined || camera === undefined) {
    return (
      <Screen testID="frame-edit">
        <EmptyState title={t('notFound')} hint={t('notFoundHint')} testID="frame-not-found" />
      </Screen>
    );
  }

  return <FrameEditor key={frame.id} initial={frame} roll={roll} camera={camera} />;
}

interface FrameEditorProps {
  initial: Frame;
  roll: Roll;
  camera: Camera;
}

function FrameEditor({ initial, roll, camera }: FrameEditorProps) {
  const { t } = useTranslation(FRAMES_NAMESPACE);
  const { palette, fontSize } = useTheme();

  const [frame, setFrame] = useState<Frame>(initial);
  const initialTakenAt = splitTakenAt(initial.takenAt);
  const [takenDate, setTakenDate] = useState(initialTakenAt.date);
  const [takenTime, setTakenTime] = useState(initialTakenAt.time);
  const [locationHint, setLocationHint] = useState<string | null>(null);

  const lenses = useActive('lenses');
  const allFilters = useActive('filters');
  const flashes = useActive('flashes');
  const allFrames = useActive('frames');
  const upsert = useStore((state) => state.upsert);
  const softDelete = useStore((state) => state.softDelete);
  const { busy: locating, requestPosition } = useLocation();

  const patch = (changes: Partial<Frame>) => setFrame((current) => ({ ...current, ...changes }));

  const lens = lenses.find((candidate) => candidate.id === frame.lensId) ?? null;
  const flash = flashes.find((candidate) => candidate.id === frame.flashId) ?? null;
  const editable = editableFields(frame.exposureMode);

  const mountedFilters = useMemo(
    () => frame.filterIds.map((id) => allFilters.find((f) => f.id === id)).filter(isPresent),
    [frame.filterIds, allFilters],
  );
  const siblingFrames = useMemo(
    () => allFrames.filter((other) => other.rollId === frame.rollId && other.id !== frame.id),
    [allFrames, frame.rollId, frame.id],
  );
  const context: FrameContext = useMemo(
    () => ({ camera, roll, lens, filters: mountedFilters, flash, siblingFrames }),
    [camera, roll, lens, mountedFilters, flash, siblingFrames],
  );
  const issues = useMemo(() => validateFrame(frame, context), [frame, context]);
  const blocked = issues.some((issue) => issue.level === 'error');

  const title = t('title', { no: frame.frameNo, total: roll.exposures });
  const isLastFrame = frame.frameNo >= roll.exposures;

  /** Writes the edited frame (including the two time fields) to the store. */
  const persist = (): Frame => {
    const saved: Frame = { ...frame, takenAt: joinTakenAt(takenDate, takenTime) };
    upsert('frames', saved);
    return saved;
  };

  const onSave = () => {
    persist();
    router.back();
  };

  /** Saves and immediately opens the following frame, which inherits the camera's setup. */
  const onSaveNext = () => {
    const saved = persist();
    const next = newFrame({
      rollId: saved.rollId,
      frameNo: nextFrameNo(selectFramesForRoll(useStore.getState(), saved.rollId)),
      camera,
      previous: saved,
      now: now(),
    });
    upsert('frames', next);
    router.replace(`/frames/${next.id}`);
  };

  const onDelete = () => {
    confirmDestructive({
      title: t('delete'),
      message: t('deleteConfirm'),
      confirmLabel: t('common:actions.delete'),
      cancelLabel: t('common:actions.cancel'),
      onConfirm: () => {
        softDelete('frames', frame.id);
        router.back();
      },
    });
  };

  const onLensChange = (lensId: Id | null) => {
    const chosen = lenses.find((candidate) => candidate.id === lensId) ?? null;
    setFrame((current) => applyLensChange(current, chosen, allFilters));
  };

  const onFlashChange = (flashId: Id | null) => {
    // Head, power and the exposure check only exist together with a flash unit.
    patch(
      flashId === null
        ? { flashId: null, flashHead: null, flashPower: null, flashOk: null }
        : { flashId },
    );
  };

  const onLocationName = (name: string) => {
    const trimmed = name.trim() === '' ? null : name;
    const lat = frame.location?.lat ?? null;
    const lon = frame.location?.lon ?? null;
    patch(
      trimmed === null && lat === null && lon === null
        ? { location: null }
        : { location: { name: trimmed, lat, lon } },
    );
  };

  const onUseCurrentPosition = async () => {
    const result = await requestPosition();
    if (result.status === 'granted') {
      setLocationHint(null);
      patch({ location: { name: frame.location?.name ?? null, lat: result.lat, lon: result.lon } });
      return;
    }
    setLocationHint(result.status === 'denied' ? t('location.denied') : t('location.unavailable'));
  };

  const labelled = <T extends string>(values: T[], prefix: string): SelectOption<T>[] =>
    values.map((value) => ({ value, label: t(`${prefix}.${value}`) }));

  const coordinates = frame.location;
  const hasCoordinates = coordinates?.lat !== null && coordinates?.lon !== null;

  return (
    <Screen title={title} testID="frame-edit">
      <Stack.Screen options={{ title }} />

      <Section title={t('sections.exposure')} testID="frame-section-exposure">
        <SelectField<ExposureMode>
          label={t('fields.mode')}
          value={frame.exposureMode}
          options={camera.exposureModes.map((mode) => ({ value: mode, label: mode }))}
          onChange={(mode) => patch({ exposureMode: mode })}
          nullable
          testID="frame-mode"
        />
        {editable.shutter && (
          <SelectField<ShutterSpeed>
            label={t('fields.shutter')}
            value={frame.shutterSpeed}
            options={shutterSpeedsForMode(camera, frame.exposureMode).map((speed) => ({
              value: speed,
              label: speed,
            }))}
            onChange={(speed) => patch({ shutterSpeed: speed })}
            nullable
            testID="frame-shutter"
          />
        )}
        {editable.aperture && (
          <SelectField<number>
            label={t('fields.aperture')}
            value={frame.aperture}
            options={apertureValuesForLens(lens).map((value) => ({
              value,
              label: `f/${value}`,
            }))}
            onChange={(aperture) => patch({ aperture })}
            nullable
            testID="frame-aperture"
          />
        )}
        {editable.compensation && (
          <NumberField
            label={t('fields.compensation')}
            value={frame.exposureCompensationEv}
            onChange={(value) => patch({ exposureCompensationEv: value ?? 0 })}
            step={camera.exposureCompensation.step}
            min={camera.exposureCompensation.min}
            max={camera.exposureCompensation.max}
            testID="frame-compensation"
          />
        )}
        {editable.programShift && (
          <SwitchField
            label={t('fields.programShift')}
            value={frame.programShift}
            onChange={(programShift) => patch({ programShift })}
            testID="frame-program-shift"
          />
        )}
        <SwitchField
          label={t('fields.aeLock')}
          value={frame.aeLock}
          onChange={(aeLock) => patch({ aeLock })}
          testID="frame-ae-lock"
        />
      </Section>

      <Section title={t('sections.optics')} testID="frame-section-optics">
        <SelectField<Id>
          label={t('fields.lens')}
          value={frame.lensId}
          options={lenses.map((candidate) => ({ value: candidate.id, label: candidate.model }))}
          onChange={onLensChange}
          nullable
          testID="frame-lens"
        />
        <SelectField<number>
          label={t('fields.focalLength')}
          value={frame.focalLengthMm}
          options={focalLengthOptions(lens).map((value) => ({ value, label: `${value} mm` }))}
          onChange={(focalLengthMm) => patch({ focalLengthMm })}
          nullable
          testID="frame-focal-length"
        />
        <MultiSelectField<Id>
          label={t('fields.filters')}
          values={frame.filterIds}
          options={filterOptions(allFilters, lens).map((filter) => ({
            value: filter.id,
            label: filter.model,
          }))}
          onChange={(filterIds) => patch({ filterIds })}
          testID="frame-filters"
        />
        {lens?.hasHood === true && (
          <SwitchField
            label={t('fields.lensHood')}
            value={frame.lensHood}
            onChange={(lensHood) => patch({ lensHood })}
            testID="frame-lens-hood"
          />
        )}
      </Section>

      <Section title={t('sections.focus')} testID="frame-section-focus">
        <SelectField<FocusMode>
          label={t('fields.focusMode')}
          value={frame.focusMode}
          options={labelled(camera.focusModes, 'focusModes')}
          onChange={(focusMode) => patch({ focusMode })}
          nullable
          testID="frame-focus-mode"
        />
        <SelectField<AfResult>
          label={t('fields.afResult')}
          value={frame.afResult}
          options={labelled(AF_RESULTS, 'afResults')}
          onChange={(afResult) => patch({ afResult })}
          nullable
          testID="frame-af-result"
        />
        <SelectField<DriveMode>
          label={t('fields.driveMode')}
          value={frame.driveMode}
          options={labelled(camera.driveModes, 'driveModes')}
          onChange={(driveMode) => patch({ driveMode })}
          nullable
          testID="frame-drive-mode"
        />
        <SwitchField
          label={t('fields.beepWarning')}
          value={frame.beepWarning}
          onChange={(beepWarning) => patch({ beepWarning })}
          testID="frame-beep-warning"
        />
      </Section>

      <Section title={t('sections.flash')} testID="frame-section-flash">
        <SelectField<Id>
          label={t('fields.flash')}
          value={frame.flashId}
          options={flashes.map((candidate) => ({ value: candidate.id, label: candidate.model }))}
          onChange={onFlashChange}
          nullable
          testID="frame-flash"
        />
        {flash !== null && (
          <>
            <SelectField<FlashHead>
              label={t('fields.flashHead')}
              value={frame.flashHead}
              options={labelled(flash.headPositions, 'flashHeads')}
              onChange={(flashHead) => patch({ flashHead })}
              nullable
              testID="frame-flash-head"
            />
            <SelectField<string>
              label={t('fields.flashPower')}
              value={frame.flashPower}
              options={flash.powerLevels.map((level) => ({ value: level, label: level }))}
              onChange={(flashPower) => patch({ flashPower })}
              nullable
              testID="frame-flash-power"
            />
            <SwitchField
              label={t('fields.flashOk')}
              value={frame.flashOk === true}
              onChange={(flashOk) => patch({ flashOk })}
              testID="frame-flash-ok"
            />
          </>
        )}
      </Section>

      <Section title={t('sections.context')} testID="frame-section-context">
        <SelectField<Support>
          label={t('fields.support')}
          value={frame.support}
          options={labelled(SUPPORTS, 'support')}
          onChange={(support) => patch({ support })}
          nullable
          testID="frame-support"
        />
        <SelectField<string>
          label={t('fields.light')}
          value={frame.light}
          options={labelled(LIGHT_OPTIONS, 'light')}
          onChange={(light) => patch({ light })}
          nullable
          testID="frame-light"
        />
        <SelectField<string>
          label={t('fields.subject')}
          value={frame.subject}
          options={labelled(SUBJECT_OPTIONS, 'subject')}
          onChange={(subject) => patch({ subject })}
          nullable
          testID="frame-subject"
        />
        <TextField
          label={t('fields.locationName')}
          value={frame.location?.name ?? ''}
          onChangeText={onLocationName}
          placeholder={t('placeholders.locationName')}
          testID="frame-location-name"
        />
        <Button
          title={locating ? t('location.locating') : t('location.useCurrent')}
          variant="secondary"
          disabled={locating}
          onPress={() => void onUseCurrentPosition()}
          testID="frame-location-button"
        />
        {hasCoordinates && (
          <Text
            testID="frame-location-coords"
            style={[styles.coords, { color: palette.textMuted, fontSize: fontSize.sm }]}
          >
            {`${String(coordinates?.lat)}, ${String(coordinates?.lon)}`}
          </Text>
        )}
        {locationHint !== null && (
          <Text
            testID="frame-location-hint"
            style={[styles.coords, { color: palette.warning, fontSize: fontSize.sm }]}
          >
            {locationHint}
          </Text>
        )}
        <TextField
          label={t('fields.date')}
          value={takenDate}
          onChangeText={setTakenDate}
          placeholder={t('placeholders.date')}
          testID="frame-taken-date"
        />
        <TextField
          label={t('fields.time')}
          value={takenTime}
          onChangeText={setTakenTime}
          placeholder={t('placeholders.time')}
          testID="frame-taken-time"
        />
        <TextField
          label={t('fields.notes')}
          value={frame.notes}
          onChangeText={(notes) => patch({ notes })}
          placeholder={t('placeholders.notes')}
          multiline
          testID="frame-notes"
        />
      </Section>

      {issues.length > 0 && (
        <Section title={t('sections.issues')} testID="frame-section-issues">
          <IssueList issues={issues} testID="frame-issues" />
        </Section>
      )}

      <View style={styles.actions}>
        <Button title={t('save')} onPress={onSave} disabled={blocked} testID="frame-save" />
        {!isLastFrame && (
          <Button
            title={t('saveNext')}
            variant="secondary"
            onPress={onSaveNext}
            disabled={blocked}
            testID="frame-save-next"
          />
        )}
        <Button
          title={t('export')}
          variant="secondary"
          onPress={() => router.push(`/export/frame/${frame.id}`)}
          testID="frame-export"
        />
        <Button
          title={t('delete')}
          variant="danger"
          onPress={onDelete}
          testID="frame-delete"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8 },
  coords: { fontWeight: '500' },
});
