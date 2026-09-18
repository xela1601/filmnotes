/**
 * Create and edit screen of a roll (spec §2.1 step 2).
 *
 * The screen is a thin shell around `rollForm.ts`: it holds the form values, renders
 * one field per value and writes the record to the store when the values validate.
 */
import type { FilmStock, Id, IsoSource, Roll } from "@filmnotes/domain";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ROLLS_NAMESPACE } from "./i18n";
import { StyleSheet, Text, View } from "react-native";

import { useActive, useEntity } from "../../store/hooks";
import { useStore } from "../../store/store";
import { now } from "../../lib/clock";
import {
  Button,
  EmptyState,
  Screen,
  Section,
  SelectField,
  NumberField,
  TextField,
  useTheme,
  type SelectOption,
} from "../../ui";
import {
  applyFilmStock,
  dateInputFromIso,
  defaultRollForm,
  formFromRoll,
  isoFromDateInput,
  rollFromForm,
  validateRollForm,
  type Exposures,
  type RollFormErrors,
  type RollFormValues,
} from "./rollForm";

/** Film stocks are picked in two groups, because that is how they sit in the fridge. */
type FilmType = "color" | "bw";

/** Push/pull is dialled in whole stops, two either way is already extreme. */
const PUSH_PULL_MIN = -3;
const PUSH_PULL_MAX = 3;

export interface RollFormProps {
  mode: "create" | "edit";
  /** The roll to edit; ignored in create mode. */
  rollId?: Id;
}

export function RollForm({ mode, rollId }: RollFormProps) {
  const { t } = useTranslation(ROLLS_NAMESPACE);
  const existing = useEntity("rolls", mode === "edit" ? (rollId ?? null) : null) ?? null;

  if (mode === "edit" && existing === null) {
    return (
      <Screen testID="roll-form">
        <EmptyState title={t("notFound")} hint={t("notFoundHint")} testID="roll-form-not-found" />
      </Screen>
    );
  }

  // Remounts once the roll to edit is known, so the fields start from its values.
  return <RollFormFields key={existing?.id ?? "new"} existing={existing} />;
}

function filmTypeOf(stock: FilmStock | undefined): FilmType {
  return stock !== undefined && !stock.color ? "bw" : "color";
}

function RollFormFields({ existing }: { existing: Roll | null }) {
  const { t } = useTranslation(ROLLS_NAMESPACE);
  const { palette, fontSize } = useTheme();
  const cameras = useActive("cameras");
  const filmStocks = useActive("filmStocks");
  const upsert = useStore((state) => state.upsert);

  const [values, setValues] = useState<RollFormValues>(() =>
    existing === null ? defaultRollForm(cameras, filmStocks, now()) : formFromRoll(existing),
  );
  const [errors, setErrors] = useState<RollFormErrors>({});
  const [filmType, setFilmType] = useState<FilmType>(() =>
    filmTypeOf(filmStocks.find((stock) => stock.id === values.filmStockId)),
  );
  // Kept next to `values.loadedAt` so a half-typed date stays on screen.
  const [dateInput, setDateInput] = useState(() => dateInputFromIso(values.loadedAt));

  const patch = (fields: Partial<RollFormValues>) =>
    setValues((current) => ({ ...current, ...fields }));

  const cameraOptions: SelectOption<Id>[] = cameras.map((camera) => ({
    value: camera.id,
    label: `${camera.make} ${camera.model}`,
  }));

  const filmTypeOptions: SelectOption<FilmType>[] = [
    { value: "color", label: t("filmTypes.color") },
    { value: "bw", label: t("filmTypes.bw") },
  ];

  const stocksOfType = filmStocks
    .filter((stock) => filmTypeOf(stock) === filmType)
    .sort((a, b) => a.name.localeCompare(b.name));

  const filmStockOptions: SelectOption<Id>[] = stocksOfType.map((stock) => ({
    value: stock.id,
    label: `${stock.name} · ISO ${stock.iso}`,
  }));

  const isoSourceOptions: SelectOption<IsoSource>[] = [
    { value: "DX", label: t("isoSources.DX") },
    { value: "manual", label: t("isoSources.manual") },
  ];

  const exposureOptions: SelectOption<Exposures>[] = [
    { value: 24, label: "24" },
    { value: 36, label: "36" },
  ];

  const changeFilmType = (next: FilmType | null) => {
    const type = next ?? "color";
    setFilmType(type);
    // The previous stock belongs to the other group, so the choice starts over.
    const selected = filmStocks.find((stock) => stock.id === values.filmStockId);
    if (selected !== undefined && filmTypeOf(selected) !== type) patch({ filmStockId: null });
  };

  const changeFilmStock = (id: Id | null) => {
    const stock = filmStocks.find((candidate) => candidate.id === id);
    if (stock === undefined) {
      patch({ filmStockId: null });
      return;
    }
    setValues((current) => applyFilmStock(current, stock));
  };

  const changeDate = (text: string) => {
    setDateInput(text);
    patch({ loadedAt: isoFromDateInput(text) ?? "" });
  };

  const save = () => {
    const found = validateRollForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const roll = rollFromForm(values, existing, now());
    upsert("rolls", roll);
    router.replace(`/rolls/${roll.id}`);
  };

  const error = (field: keyof RollFormValues) => {
    const code = errors[field];
    if (code === undefined) return null;
    return (
      <Text
        testID={`roll-form-error-${field}`}
        style={[styles.error, { color: palette.danger, fontSize: fontSize.sm }]}
      >
        {t(`errors.${code}`)}
      </Text>
    );
  };

  return (
    <Screen title={existing === null ? t("new") : t("edit")} testID="roll-form">
      <Section title={t("sections.film")}>
        <View>
          <SelectField
            label={t("fields.camera")}
            value={values.cameraId}
            options={cameraOptions}
            onChange={(next) => patch({ cameraId: next })}
            testID="roll-form-camera"
          />
          {error("cameraId")}
        </View>

        <SelectField
          label={t("fields.filmType")}
          value={filmType}
          options={filmTypeOptions}
          onChange={changeFilmType}
          testID="roll-form-film-type"
        />

        <View>
          <SelectField
            label={t("fields.filmStock")}
            value={values.filmStockId}
            options={filmStockOptions}
            onChange={changeFilmStock}
            testID="roll-form-film-stock"
          />
          {error("filmStockId")}
        </View>

        <View>
          <NumberField
            label={t("fields.iso")}
            value={values.isoSet}
            onChange={(next) => patch({ isoSet: next })}
            testID="roll-form-iso"
          />
          {error("isoSet")}
        </View>

        <SelectField
          label={t("fields.isoSource")}
          value={values.isoSource}
          options={isoSourceOptions}
          onChange={(next) => patch({ isoSource: next ?? "DX" })}
          testID="roll-form-iso-source"
        />

        <SelectField
          label={t("fields.exposures")}
          value={values.exposures}
          options={exposureOptions}
          onChange={(next) => patch({ exposures: next ?? 36 })}
          testID="roll-form-exposures"
        />

        <NumberField
          label={t("fields.pushPull")}
          value={values.pushPullEv}
          onChange={(next) => patch({ pushPullEv: next ?? 0 })}
          step={1}
          min={PUSH_PULL_MIN}
          max={PUSH_PULL_MAX}
          testID="roll-form-push-pull"
        />
      </Section>

      <Section title={t("sections.development")}>
        <View>
          <TextField
            label={t("fields.loadedAt")}
            value={dateInput}
            onChangeText={changeDate}
            placeholder="YYYY-MM-DD"
            testID="roll-form-loaded-at"
          />
          {error("loadedAt")}
        </View>

        <TextField
          label={t("fields.lab")}
          value={values.lab}
          onChangeText={(lab) => patch({ lab })}
          testID="roll-form-lab"
        />

        <TextField
          label={t("fields.notes")}
          value={values.notes}
          onChangeText={(notes) => patch({ notes })}
          multiline
          testID="roll-form-notes"
        />
      </Section>

      <Button title={t("actions.save", { ns: "common" })} onPress={save} testID="roll-form-save" />
      <Button
        title={t("actions.cancel", { ns: "common" })}
        variant="secondary"
        onPress={() => router.back()}
        testID="roll-form-cancel"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { fontWeight: "600", marginTop: 4 },
});
