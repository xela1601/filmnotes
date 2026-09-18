/**
 * Tests for the generic equipment editor.
 *
 * The screen renders whatever `DESCRIPTORS` says, so these tests work through one
 * field of every kind: text, number, select, switch, editable list and a multi-select
 * whose options are the records of another collection.
 */
import type { Camera, FilmStock, Lens } from '@filmnotes/domain';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { i18n } from '../../i18n';
import { useStore } from '../../store/store';
import { FIXTURE_NOW } from '../../testing/fixtures';
import { EquipmentEditRoute, EquipmentEditScreen } from './EquipmentEditScreen';
import { EquipmentListScreen } from './EquipmentListScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

const LENS_50 = 'lens0min50f1700';
const CAMERA = 'cam0minolta7000';
const UV_FILTER = 'filt0hamauv49a0';

const storedLens = (id: string): Lens => {
  const lens = useStore.getState().entities.lenses[id];
  if (lens === undefined) throw new Error(`lens ${id} is not in the store`);
  return lens;
};

const storedCamera = (id: string): Camera => {
  const camera = useStore.getState().entities.cameras[id];
  if (camera === undefined) throw new Error(`camera ${id} is not in the store`);
  return camera;
};

const filmStockNamed = (name: string): FilmStock | undefined =>
  Object.values(useStore.getState().entities.filmStocks).find((stock) => stock.name === name);

describe('EquipmentEditScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useStore.getState().resetAll();
    useStore.getState().seedPresets(FIXTURE_NOW);
    await i18n.changeLanguage('de');
  });

  it('creates a film stock and shows it in the list', () => {
    const editor = render(<EquipmentEditScreen type="filmStocks" id={null} />);

    fireEvent.changeText(screen.getByTestId('equipment-field-name'), 'Kodak Portra 800');
    fireEvent.changeText(screen.getByTestId('equipment-field-maker'), 'Kodak');
    fireEvent.changeText(screen.getByTestId('equipment-field-iso'), '800');
    fireEvent.press(screen.getByTestId('equipment-field-process-option-C41'));
    fireEvent(screen.getByTestId('equipment-field-color'), 'valueChange', true);
    fireEvent.press(screen.getByTestId('equipment-save'));

    const stored = filmStockNamed('Kodak Portra 800');
    expect(stored).toMatchObject({
      maker: 'Kodak',
      iso: 800,
      process: 'C41',
      color: true,
      exposures: 36,
      deleted: null,
    });
    expect(router.back).toHaveBeenCalledTimes(1);
    // The sync engine (T-008) picks the new record up from the outbox.
    expect(
      useStore.getState().outbox.some((entry) => entry.id === stored?.id),
    ).toBe(true);

    editor.unmount();
    render(<EquipmentListScreen />);
    fireEvent.press(screen.getByTestId('equipment-type-filmStocks'));

    expect(screen.getByTestId(`equipment-item-${stored?.id ?? 'missing'}`)).toHaveTextContent(
      'Kodak Portra 800',
      { exact: false },
    );
  });

  it('keeps the untouched fields of a new record', () => {
    render(<EquipmentEditScreen type="filmStocks" id={null} />);

    fireEvent.changeText(screen.getByTestId('equipment-field-name'), 'Ilford Delta 100');
    fireEvent.changeText(screen.getByTestId('equipment-field-maker'), 'Ilford');
    fireEvent.changeText(screen.getByTestId('equipment-field-iso'), '100');
    fireEvent.press(screen.getByTestId('equipment-field-process-option-BW'));
    fireEvent(screen.getByTestId('equipment-field-color'), 'valueChange', false);
    fireEvent.press(screen.getByTestId('equipment-field-dxCoded-option-unknown'));
    fireEvent.press(screen.getByTestId('equipment-save'));

    expect(filmStockNamed('Ilford Delta 100')).toMatchObject({
      process: 'BW',
      color: false,
      dxCoded: null,
      notes: '',
    });
  });

  it('persists the hand-held limit of the 50 mm lens', () => {
    render(<EquipmentEditScreen type="lenses" id={LENS_50} />);

    expect(screen.getByDisplayValue('1/60')).toBeOnTheScreen();
    fireEvent.changeText(screen.getByTestId('equipment-field-handheldMinShutter'), '1/125');
    fireEvent.press(screen.getByTestId('equipment-save'));

    const lens = storedLens(LENS_50);
    expect(lens.handheldMinShutter).toBe('1/125');
    // Edited in place: the record keeps its id, so every frame still points at it.
    expect(lens.apertureValues).toHaveLength(16);
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('shows an error and blocks the save for an unparseable shutter speed', () => {
    render(<EquipmentEditScreen type="lenses" id={LENS_50} />);

    fireEvent.changeText(screen.getByTestId('equipment-field-handheldMinShutter'), '1/');
    fireEvent.press(screen.getByTestId('equipment-save'));

    expect(screen.getByTestId('equipment-error-handheldMinShutter')).toHaveTextContent(
      i18n.t('equipment:errors.invalid'),
    );
    expect(storedLens(LENS_50).handheldMinShutter).toBe('1/60');
    expect(router.back).not.toHaveBeenCalled();
  });

  it('requires make and model before a new lens can be saved', () => {
    render(<EquipmentEditScreen type="lenses" id={null} />);

    fireEvent.press(screen.getByTestId('equipment-save'));

    expect(screen.getByTestId('equipment-error-make')).toHaveTextContent(
      i18n.t('equipment:errors.required'),
    );
    expect(screen.getByTestId('equipment-error-model')).toHaveTextContent(
      i18n.t('equipment:errors.required'),
    );
    expect(Object.keys(useStore.getState().entities.lenses)).toHaveLength(3);
    expect(router.back).not.toHaveBeenCalled();
  });

  it('edits a shutter speed list', () => {
    render(<EquipmentEditScreen type="cameras" id={CAMERA} />);

    fireEvent.changeText(
      screen.getByTestId('equipment-field-shutterSpeedsAutoExtra-input'),
      '1/4000',
    );
    fireEvent.press(screen.getByTestId('equipment-field-shutterSpeedsAutoExtra-add'));
    fireEvent.press(screen.getByTestId('equipment-field-shutterSpeedsManual-remove-0'));
    fireEvent.press(screen.getByTestId('equipment-save'));

    const camera = storedCamera(CAMERA);
    expect(camera.shutterSpeedsAutoExtra).toContain('1/4000');
    expect(camera.shutterSpeedsAutoExtra).toHaveLength(17);
    expect(camera.shutterSpeedsManual[0]).toBe('15"');
    expect(camera.shutterSpeedsManual).toHaveLength(17);
  });

  it('rejects a list entry that is not a shutter speed', () => {
    render(<EquipmentEditScreen type="cameras" id={CAMERA} />);

    fireEvent.changeText(
      screen.getByTestId('equipment-field-shutterSpeedsManual-input'),
      'schnell',
    );
    fireEvent.press(screen.getByTestId('equipment-field-shutterSpeedsManual-add'));
    fireEvent.press(screen.getByTestId('equipment-save'));

    expect(screen.getByTestId('equipment-error-shutterSpeedsManual')).toHaveTextContent(
      i18n.t('equipment:errors.invalid'),
    );
    expect(storedCamera(CAMERA).shutterSpeedsManual).not.toContain('schnell');
  });

  it('references other equipment through a multi-select of that collection', () => {
    render(<EquipmentEditScreen type="lenses" id={LENS_50} />);

    fireEvent.press(screen.getByTestId(`equipment-field-defaultFilterIds-option-${UV_FILTER}`));
    fireEvent.press(screen.getByTestId('equipment-save'));

    expect(storedLens(LENS_50).defaultFilterIds).toEqual(['filt0hamauv49b0', UV_FILTER]);
  });

  it('edits a nested numeric field', () => {
    render(<EquipmentEditScreen type="cameras" id={CAMERA} />);

    fireEvent.changeText(screen.getByTestId('equipment-field-iso.max'), '12800');
    fireEvent.press(screen.getByTestId('equipment-save'));

    const camera = storedCamera(CAMERA);
    expect(camera.iso.max).toBe(12800);
    expect(camera.iso.min).toBe(25);
  });

  it('soft-deletes a record after confirmation and drops it from the list', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const editor = render(<EquipmentEditScreen type="lenses" id={LENS_50} />);

    fireEvent.press(screen.getByTestId('equipment-delete'));
    const confirm = alert.mock.calls[0]?.[2]?.find((button) => button.style === 'destructive');
    expect(confirm).toBeDefined();
    act(() => confirm?.onPress?.());

    expect(storedLens(LENS_50).deleted).not.toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/equipment');

    editor.unmount();
    render(<EquipmentListScreen />);
    fireEvent.press(screen.getByTestId('equipment-type-lenses'));

    expect(screen.queryByTestId(`equipment-item-${LENS_50}`)).toBeNull();
    alert.mockRestore();
  });

  it('offers no delete action while creating a record', () => {
    render(<EquipmentEditScreen type="flashes" id={null} />);

    expect(screen.queryByTestId('equipment-delete')).toBeNull();
  });

  it('shows a hint when the record does not exist', () => {
    render(<EquipmentEditScreen type="lenses" id="lens00000000000" />);

    expect(screen.getByTestId('equipment-editor-not-found')).toBeOnTheScreen();
    expect(screen.getByText(i18n.t('equipment:notFound'))).toBeOnTheScreen();
  });

  it('edits the record the route parameters name', () => {
    render(<EquipmentEditRoute type="lenses" id={LENS_50} />);

    expect(screen.getByDisplayValue('AF 50mm f/1.7')).toBeOnTheScreen();
  });

  it('creates a record for the `new` route parameter', () => {
    render(<EquipmentEditRoute type="flashes" id="new" />);

    expect(screen.queryByTestId('equipment-delete')).toBeNull();
    expect(screen.getByTestId('equipment-field-make')).toHaveDisplayValue('');
  });

  it('shows a hint for an unknown equipment type', () => {
    render(<EquipmentEditRoute type="rolls" id="roll00000000001" />);

    expect(screen.getByTestId('equipment-editor-not-found')).toBeOnTheScreen();
  });

  it('returns without writing when the editor is cancelled', () => {
    render(<EquipmentEditScreen type="lenses" id={LENS_50} />);

    fireEvent.changeText(screen.getByTestId('equipment-field-model'), 'Nope');
    fireEvent.press(screen.getByTestId('equipment-cancel'));

    expect(storedLens(LENS_50).model).toBe('AF 50mm f/1.7');
    expect(router.back).toHaveBeenCalledTimes(1);
  });
});
