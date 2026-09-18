/**
 * Tests for the equipment list – the entry point of the equipment tab.
 *
 * The store is seeded with the shipped Minolta preset, so the ids used here are the real
 * ones (`cam0minolta7000`, `lens0min50f1700`, …).
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { i18n } from '../../i18n';
import { useStore } from '../../store/store';
import { FIXTURE_NOW } from '../../testing/fixtures';
import { EquipmentListScreen } from './EquipmentListScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

const items = () => screen.getAllByTestId(/^equipment-item-/);

describe('EquipmentListScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useStore.getState().resetAll();
    useStore.getState().seedPresets(FIXTURE_NOW);
    await i18n.changeLanguage('de');
  });

  it('starts on the cameras and shows the seeded camera', () => {
    render(<EquipmentListScreen />);

    expect(screen.getByText(i18n.t('equipment:types.cameras'))).toBeOnTheScreen();
    expect(items()).toHaveLength(1);
    expect(screen.getByTestId('equipment-item-cam0minolta7000')).toHaveTextContent(
      'Minolta 7000 AF',
      { exact: false },
    );
  });

  it('switches to the lenses of the kit', () => {
    render(<EquipmentListScreen />);

    fireEvent.press(screen.getByTestId('equipment-type-lenses'));

    expect(items()).toHaveLength(3);
    expect(screen.getByTestId('equipment-item-lens0min50f1700')).toHaveTextContent(
      'Minolta AF 50mm f/1.7',
      { exact: false },
    );
  });

  it('lists the whole film stock catalogue', () => {
    render(<EquipmentListScreen />);

    fireEvent.press(screen.getByTestId('equipment-type-filmStocks'));

    expect(items().length).toBeGreaterThanOrEqual(20);
    expect(screen.getByTestId('equipment-item-film0kodakgold2')).toHaveTextContent(
      i18n.t('equipment:summaries.filmStock', { iso: 200, process: 'C41' }),
      { exact: false },
    );
  });

  it('opens a record for editing', () => {
    render(<EquipmentListScreen />);

    fireEvent.press(screen.getByTestId('equipment-type-filters'));
    fireEvent.press(screen.getByTestId('equipment-item-filt0kenkopl490'));

    expect(router.push).toHaveBeenCalledWith('/equipment/filters/filt0kenkopl490');
  });

  it('adds a record of the selected type', () => {
    render(<EquipmentListScreen />);

    fireEvent.press(screen.getByTestId('equipment-type-flashes'));
    fireEvent.press(screen.getByTestId('equipment-new'));

    expect(router.push).toHaveBeenCalledWith('/equipment/flashes/new');
  });

  it('hides deleted records', () => {
    useStore.getState().softDelete('lenses', 'lens0min50f1700');

    render(<EquipmentListScreen />);
    fireEvent.press(screen.getByTestId('equipment-type-lenses'));

    expect(screen.queryByTestId('equipment-item-lens0min50f1700')).toBeNull();
    expect(items()).toHaveLength(2);
  });

  it('explains what to do when a type is empty', () => {
    useStore.getState().softDelete('flashes', 'flash0min2800af');

    render(<EquipmentListScreen />);
    fireEvent.press(screen.getByTestId('equipment-type-flashes'));

    expect(screen.getByText(i18n.t('equipment:empty'))).toBeOnTheScreen();
    expect(screen.getByText(i18n.t('equipment:emptyHint'))).toBeOnTheScreen();
  });

  it('sorts the entries by name', () => {
    render(<EquipmentListScreen />);
    fireEvent.press(screen.getByTestId('equipment-type-lenses'));

    expect(items().map((item) => item.props.testID)).toEqual([
      'equipment-item-lens0min50f1700',
      'equipment-item-lens0min3570f40',
      'equipment-item-lens0min70210f4',
    ]);
  });
});
