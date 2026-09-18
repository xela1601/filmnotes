import * as DocumentPicker from 'expo-document-picker';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ScanImportScreen } from './ScanImportScreen';
import { openServerSession } from './session';
import { i18n } from '../../i18n';
import type { SyncClient } from '../../sync/client';
import { FakeSyncClient } from '../../sync/fakeClient';
import { useStore } from '../../store/store';
import { FIXTURE_NOW, makeFrame, makeRoll } from '../../testing/fixtures';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}));

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

// The ZIP branch is not exercised here, but importing `pickScans` loads the module.
jest.mock('expo-file-system', () => ({
  File: class {},
  Directory: class {},
  Paths: { cache: { uri: 'file:///cache' } },
}));

// `session.ts` reaches the ESM-only `pocketbase` SDK through `src/sync/client.ts`.
jest.mock('./session', () => ({ openServerSession: jest.fn() }));

// The real component resolves `source` into its own shape; a bare host component keeps
// the props the screen passed, which is what this test is about.
jest.mock('expo-image', () => ({ Image: 'Image' }));

const getDocumentAsync = DocumentPicker.getDocumentAsync as jest.Mock;
const serverSession = openServerSession as jest.Mock;

const ROLL_ID = 'roll00000000001';
const OWNER_ID = 'user00000000001';

/** `frame0000000003` – the store only accepts 15-character ids. */
const frameId = (index: number): string => `frame${String(index).padStart(10, '0')}`;

function threeFrameRoll(status: 'loaded' | 'shot' | 'at_lab' | 'developed' = 'at_lab'): void {
  const { upsert } = useStore.getState();
  upsert('rolls', makeRoll({ id: ROLL_ID, status }));
  for (const frameNo of [1, 2, 3]) {
    upsert(
      'frames',
      makeFrame({
        id: frameId(frameNo),
        rollId: ROLL_ID,
        frameNo,
        notes: `note ${frameNo}`,
      }),
    );
  }
}

function configureServer(): void {
  useStore.getState().updateSettings({
    serverUrl: 'https://pb.test',
    serverEmail: 'owner@example.org',
  });
}

/** The picker answers with three JPEGs, deliberately not in name order. */
function pickerReturnsThreeFiles(): void {
  getDocumentAsync.mockResolvedValue({
    canceled: false,
    assets: ['scan_2.jpg', 'scan_10.jpg', 'scan_1.jpg'].map((name) => ({
      name,
      uri: `file:///picked/${name}`,
      mimeType: 'image/jpeg',
      size: 8,
    })),
  });
}

/** A session whose upload of one named file always fails. */
function sessionWithFailingUpload(failing: string): void {
  const base = new FakeSyncClient();
  const client: SyncClient = {
    authWithPassword: (email, password) => base.authWithPassword(email, password),
    authWithToken: (token) => base.authWithToken(token),
    list: (collection, since) => base.list(collection, since),
    create: (collection, record) => base.create(collection, record),
    update: (collection, id, record) => base.update(collection, id, record),
    uploadFile: async (collection, id, field, file) => {
      if (file.name === failing) throw new Error(`upload of ${file.name} failed`);
      return base.uploadFile(collection, id, field, file);
    },
    fileUrl: (collection, id, name, thumb) => base.fileUrl(collection, id, name, thumb),
  };
  serverSession.mockResolvedValue({ client, ownerId: OWNER_ID });
}

/** Presses "pick files" and waits for the rows to appear. */
async function pickFiles(): Promise<void> {
  fireEvent.press(screen.getByTestId('scan-import-pick'));
  await waitFor(() => expect(screen.getByTestId('scan-row-0')).toBeOnTheScreen());
}

describe('ScanImportScreen without a server', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useStore.getState().resetAll();
    await i18n.changeLanguage('de');
  });

  it('explains that scans need a server and links to its settings', () => {
    threeFrameRoll();

    render(<ScanImportScreen rollId={ROLL_ID} />);

    expect(screen.getByText(i18n.t('scans:needServer'))).toBeOnTheScreen();
    expect(screen.queryByTestId('scan-import-pick')).toBeNull();

    fireEvent.press(screen.getByTestId('scan-import-server-link'));
    expect(router.push).toHaveBeenCalledWith('/settings/server');
  });

  it('shows a hint when the roll does not exist', () => {
    configureServer();

    render(<ScanImportScreen rollId="roll00000000404" />);

    expect(screen.getByText(i18n.t('scans:notFound'))).toBeOnTheScreen();
  });
});

describe('ScanImportScreen with a server', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useStore.getState().resetAll();
    useStore.getState().seedPresets(FIXTURE_NOW);
    configureServer();
    await i18n.changeLanguage('de');
    serverSession.mockResolvedValue({ client: new FakeSyncClient(), ownerId: OWNER_ID });
  });

  it('starts empty and offers the file picker', () => {
    threeFrameRoll();

    render(<ScanImportScreen rollId={ROLL_ID} />);

    expect(screen.getByTestId('scan-import-empty')).toBeOnTheScreen();
    expect(screen.getByTestId('scan-import-pick')).toBeOnTheScreen();
    expect(screen.queryByTestId('scan-import-upload')).toBeNull();
  });

  it('shows one row per picked file, matched to the frames in natural name order', async () => {
    threeFrameRoll();
    pickerReturnsThreeFiles();

    render(<ScanImportScreen rollId={ROLL_ID} />);
    await pickFiles();

    expect(screen.getByTestId('scan-row-0-name')).toHaveTextContent('scan_1.jpg');
    expect(screen.getByTestId('scan-row-1-name')).toHaveTextContent('scan_2.jpg');
    expect(screen.getByTestId('scan-row-2-name')).toHaveTextContent('scan_10.jpg');

    expect(screen.getByTestId('scan-row-0-frame-summary')).toHaveTextContent('→ #1 · note 1');
    expect(screen.getByTestId('scan-row-1-frame-summary')).toHaveTextContent('→ #2 · note 2');
    expect(screen.getByTestId('scan-row-2-frame-summary')).toHaveTextContent('→ #3 · note 3');
  });

  it('shows a preview of every picked file', async () => {
    threeFrameRoll();
    pickerReturnsThreeFiles();

    render(<ScanImportScreen rollId={ROLL_ID} />);
    await pickFiles();

    expect(screen.getByTestId('scan-row-0-thumb')).toHaveProp('source', {
      uri: 'file:///picked/scan_1.jpg',
    });
  });

  it('shifts the assignments from a row on with the down control', async () => {
    threeFrameRoll();
    pickerReturnsThreeFiles();

    render(<ScanImportScreen rollId={ROLL_ID} />);
    await pickFiles();
    fireEvent.press(screen.getByTestId('scan-row-0-down'));

    expect(screen.getByTestId('scan-row-0-frame-summary')).toHaveTextContent('→ #2 · note 2');
    expect(screen.getByTestId('scan-row-1-frame-summary')).toHaveTextContent('→ #3 · note 3');
    expect(screen.getByTestId('scan-row-2-frame-summary')).toHaveTextContent(
      i18n.t('scans:unassigned'),
    );
  });

  it('shifts back up again', async () => {
    threeFrameRoll();
    pickerReturnsThreeFiles();

    render(<ScanImportScreen rollId={ROLL_ID} />);
    await pickFiles();
    fireEvent.press(screen.getByTestId('scan-row-0-down'));
    fireEvent.press(screen.getByTestId('scan-row-0-up'));

    expect(screen.getByTestId('scan-row-0-frame-summary')).toHaveTextContent('→ #1 · note 1');
    expect(screen.getByTestId('scan-row-2-frame-summary')).toHaveTextContent('→ #3 · note 3');
  });

  it('unassigns a single row', async () => {
    threeFrameRoll();
    pickerReturnsThreeFiles();

    render(<ScanImportScreen rollId={ROLL_ID} />);
    await pickFiles();
    fireEvent.press(screen.getByTestId('scan-row-1-unassign'));

    expect(screen.getByTestId('scan-row-1-frame-summary')).toHaveTextContent(
      i18n.t('scans:unassigned'),
    );
    expect(screen.getByTestId('scan-row-0-frame-summary')).toHaveTextContent('→ #1 · note 1');
    expect(screen.getByTestId('scan-row-2-frame-summary')).toHaveTextContent('→ #3 · note 3');
  });

  it('assigns a row to a frame the user picks and frees that frame', async () => {
    threeFrameRoll();
    pickerReturnsThreeFiles();

    render(<ScanImportScreen rollId={ROLL_ID} />);
    await pickFiles();
    fireEvent.press(screen.getByTestId(`scan-row-0-frame-option-${frameId(3)}`));

    expect(screen.getByTestId('scan-row-0-frame-summary')).toHaveTextContent('→ #3 · note 3');
    expect(screen.getByTestId('scan-row-2-frame-summary')).toHaveTextContent(
      i18n.t('scans:unassigned'),
    );
  });

  it('uploads the reviewed import and reports the outcome', async () => {
    threeFrameRoll();
    pickerReturnsThreeFiles();

    render(<ScanImportScreen rollId={ROLL_ID} />);
    await pickFiles();
    fireEvent.press(screen.getByTestId('scan-import-upload'));

    await waitFor(() => expect(screen.getByTestId('scan-import-result')).toBeOnTheScreen());
    expect(screen.getByTestId('scan-import-result')).toHaveTextContent(
      i18n.t('scans:result', { uploaded: 3, total: 3 }),
    );

    const scans = Object.values(useStore.getState().entities.scans).sort(
      (a, b) => a.sortIndex - b.sortIndex,
    );
    expect(scans.map((scan) => scan.fileName)).toEqual([
      'scan_1.jpg',
      'scan_2.jpg',
      'scan_10.jpg',
    ]);
    expect(scans.map((scan) => scan.frameId)).toEqual([frameId(1), frameId(2), frameId(3)]);
    expect(scans.every((scan) => scan.file !== null)).toBe(true);
  });

  it('marks a roll at the lab as developed once scans arrived', async () => {
    threeFrameRoll('at_lab');
    pickerReturnsThreeFiles();

    render(<ScanImportScreen rollId={ROLL_ID} />);
    await pickFiles();
    fireEvent.press(screen.getByTestId('scan-import-upload'));

    await waitFor(() => expect(screen.getByTestId('scan-import-result')).toBeOnTheScreen());
    expect(useStore.getState().entities.rolls[ROLL_ID]?.status).toBe('developed');
  });

  it('leaves a roll that is still loaded alone', async () => {
    threeFrameRoll('loaded');
    pickerReturnsThreeFiles();

    render(<ScanImportScreen rollId={ROLL_ID} />);
    await pickFiles();
    fireEvent.press(screen.getByTestId('scan-import-upload'));

    await waitFor(() => expect(screen.getByTestId('scan-import-result')).toBeOnTheScreen());
    expect(useStore.getState().entities.rolls[ROLL_ID]?.status).toBe('loaded');
  });

  it('says which files did not make it', async () => {
    threeFrameRoll();
    pickerReturnsThreeFiles();
    sessionWithFailingUpload('scan_2.jpg');

    render(<ScanImportScreen rollId={ROLL_ID} />);
    await pickFiles();
    fireEvent.press(screen.getByTestId('scan-import-upload'));

    await waitFor(() => expect(screen.getByTestId('scan-import-failed')).toBeOnTheScreen());
    expect(screen.getByTestId('scan-import-failed')).toHaveTextContent(
      i18n.t('scans:resultFailed', { files: 'scan_2.jpg' }),
    );
    expect(screen.getByTestId('scan-import-result')).toHaveTextContent(
      i18n.t('scans:result', { uploaded: 2, total: 3 }),
    );
  });

  it('reports missing credentials instead of uploading', async () => {
    threeFrameRoll();
    pickerReturnsThreeFiles();
    serverSession.mockResolvedValue(null);

    render(<ScanImportScreen rollId={ROLL_ID} />);
    await pickFiles();
    fireEvent.press(screen.getByTestId('scan-import-upload'));

    await waitFor(() => expect(screen.getByTestId('scan-import-error')).toBeOnTheScreen());
    expect(screen.getByTestId('scan-import-error')).toHaveTextContent(
      i18n.t('scans:needCredentials'),
    );
    expect(useStore.getState().entities.scans).toEqual({});
  });

  it('keeps the previous selection when the picker is cancelled', async () => {
    threeFrameRoll();
    pickerReturnsThreeFiles();

    render(<ScanImportScreen rollId={ROLL_ID} />);
    await pickFiles();

    getDocumentAsync.mockResolvedValue({ canceled: true, assets: null });
    fireEvent.press(screen.getByTestId('scan-import-pick'));

    await waitFor(() => expect(screen.getByTestId('scan-row-0-name')).toHaveTextContent('scan_1.jpg'));
  });

  it('points out that the roll has no frames to assign to', () => {
    useStore.getState().upsert('rolls', makeRoll({ id: ROLL_ID, status: 'at_lab' }));

    render(<ScanImportScreen rollId={ROLL_ID} />);

    expect(screen.getByTestId('scan-import-no-frames')).toBeOnTheScreen();
  });
});
