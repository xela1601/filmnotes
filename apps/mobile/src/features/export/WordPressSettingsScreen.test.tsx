import { basicAuthHeader } from '@filmnotes/exporters';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { WordPressSettingsScreen } from './WordPressSettingsScreen';
import { i18n } from '../../i18n';
import type { SecretKey } from '../../lib/secureStore';
import { useStore } from '../../store/store';

const SITE = 'https://blog.example.test';
const USER = 'ansel';
const PASSWORD = 'abcd efgh ijkl mnop';

const mockGetSecret = jest.fn<Promise<string | null>, [SecretKey]>();
const mockSetSecret = jest.fn<Promise<void>, [SecretKey, string | null]>();

// Lazy arrow bodies: the factory runs while the screen is imported, before the consts above
// are initialised.
jest.mock('../../lib/secureStore', () => ({
  getSecret: (key: string) => mockGetSecret(key as SecretKey),
  setSecret: (key: string, value: string | null) => mockSetSecret(key as SecretKey, value),
}));

const realFetch = globalThis.fetch;

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

/** Replaces `fetch` with one canned answer and records what was requested. */
function mockFetch(response: {
  status?: number;
  body?: unknown;
  text?: string;
}): { calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const status = response.status ?? 200;
  const mock = (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response.body ?? {}),
      text: () => Promise.resolve(response.text ?? JSON.stringify(response.body ?? {})),
    } as unknown as Response);
  };
  globalThis.fetch = mock as unknown as typeof fetch;
  return { calls };
}

describe('WordPressSettingsScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useStore.getState().resetAll();
    mockGetSecret.mockResolvedValue(null);
    mockSetSecret.mockResolvedValue(undefined);
    await i18n.changeLanguage('de');
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('shows empty fields and no configuration yet', () => {
    render(<WordPressSettingsScreen />);

    expect(screen.getByTestId('wordpress-site-url')).toBeOnTheScreen();
    expect(screen.getByTestId('wordpress-username')).toBeOnTheScreen();
    expect(screen.getByTestId('wordpress-app-password')).toBeOnTheScreen();
    expect(screen.getByText(i18n.t('export:wordpress.notConfigured'))).toBeOnTheScreen();
  });

  it('prefills the stored site url, user name and app password', async () => {
    useStore.getState().updateSettings({ wordpressSiteUrl: SITE, wordpressUsername: USER });
    mockGetSecret.mockResolvedValue(PASSWORD);

    render(<WordPressSettingsScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('wordpress-app-password')).toHaveProp('value', PASSWORD);
    });
    expect(screen.getByTestId('wordpress-site-url')).toHaveProp('value', SITE);
    expect(screen.getByTestId('wordpress-username')).toHaveProp('value', USER);
    expect(mockGetSecret).toHaveBeenCalledWith('wordpressAppPassword');
  });

  it('saves site url and user name to the settings and the password to the secure store', async () => {
    render(<WordPressSettingsScreen />);

    fireEvent.changeText(screen.getByTestId('wordpress-site-url'), `${SITE}/`);
    fireEvent.changeText(screen.getByTestId('wordpress-username'), USER);
    fireEvent.changeText(screen.getByTestId('wordpress-app-password'), PASSWORD);
    fireEvent.press(screen.getByTestId('wordpress-save'));

    await waitFor(() => {
      expect(screen.getByTestId('wordpress-message')).toHaveTextContent(
        i18n.t('export:wordpress.saved'),
      );
    });
    expect(useStore.getState().settings).toMatchObject({
      wordpressSiteUrl: SITE,
      wordpressUsername: USER,
    });
    expect(mockSetSecret).toHaveBeenCalledWith('wordpressAppPassword', PASSWORD);
  });

  it('refuses to save an incomplete form', async () => {
    render(<WordPressSettingsScreen />);

    fireEvent.changeText(screen.getByTestId('wordpress-site-url'), SITE);
    fireEvent.press(screen.getByTestId('wordpress-save'));

    await waitFor(() => {
      expect(screen.getByTestId('wordpress-error')).toHaveTextContent(
        i18n.t('export:wordpress.missingFields'),
      );
    });
    expect(useStore.getState().settings.wordpressSiteUrl).toBeNull();
    expect(mockSetSecret).not.toHaveBeenCalled();
  });

  it('tests the connection against users/me with basic auth and shows the display name', async () => {
    const fetched = mockFetch({ body: { id: 1, name: 'Ansel Adams' } });
    render(<WordPressSettingsScreen />);

    fireEvent.changeText(screen.getByTestId('wordpress-site-url'), `${SITE}/`);
    fireEvent.changeText(screen.getByTestId('wordpress-username'), USER);
    fireEvent.changeText(screen.getByTestId('wordpress-app-password'), PASSWORD);
    fireEvent.press(screen.getByTestId('wordpress-test'));

    await waitFor(() => {
      expect(screen.getByTestId('wordpress-message')).toHaveTextContent(
        i18n.t('export:wordpress.testOk', { name: 'Ansel Adams' }),
      );
    });

    const call = fetched.calls[0];
    expect(call?.url).toBe(`${SITE}/wp-json/wp/v2/users/me`);
    expect(call?.init?.method ?? 'GET').toBe('GET');
    expect(call?.init?.headers).toMatchObject({
      Authorization: basicAuthHeader(USER, PASSWORD),
    });
  });

  it('shows the message WordPress answers with when the test fails', async () => {
    mockFetch({
      status: 401,
      body: { message: 'Sorry, you are not allowed to do that.' },
    });
    render(<WordPressSettingsScreen />);

    fireEvent.changeText(screen.getByTestId('wordpress-site-url'), SITE);
    fireEvent.changeText(screen.getByTestId('wordpress-username'), USER);
    fireEvent.changeText(screen.getByTestId('wordpress-app-password'), 'wrong');
    fireEvent.press(screen.getByTestId('wordpress-test'));

    await waitFor(() => {
      expect(screen.getByTestId('wordpress-error')).toHaveTextContent(
        i18n.t('export:wordpress.testFailed', {
          message: 'Sorry, you are not allowed to do that.',
        }),
      );
    });
  });

  it('refuses to test with an incomplete form', async () => {
    const fetched = mockFetch({ body: {} });
    render(<WordPressSettingsScreen />);

    fireEvent.press(screen.getByTestId('wordpress-test'));

    await waitFor(() => {
      expect(screen.getByTestId('wordpress-error')).toHaveTextContent(
        i18n.t('export:wordpress.missingFields'),
      );
    });
    expect(fetched.calls).toHaveLength(0);
  });

  it('clears the credentials from the settings and the secure store', async () => {
    useStore.getState().updateSettings({ wordpressSiteUrl: SITE, wordpressUsername: USER });
    mockGetSecret.mockResolvedValue(PASSWORD);

    render(<WordPressSettingsScreen />);
    await waitFor(() => {
      expect(screen.getByTestId('wordpress-app-password')).toHaveProp('value', PASSWORD);
    });

    fireEvent.press(screen.getByTestId('wordpress-clear'));

    await waitFor(() => {
      expect(useStore.getState().settings.wordpressSiteUrl).toBeNull();
    });
    expect(useStore.getState().settings.wordpressUsername).toBeNull();
    expect(mockSetSecret).toHaveBeenCalledWith('wordpressAppPassword', null);
    expect(screen.getByTestId('wordpress-app-password')).toHaveProp('value', '');
  });

  it('shows who the app is configured as', () => {
    useStore.getState().updateSettings({ wordpressSiteUrl: SITE, wordpressUsername: USER });

    render(<WordPressSettingsScreen />);

    expect(screen.getByTestId('wordpress-status')).toHaveTextContent(
      i18n.t('export:wordpress.configuredAs', { username: USER }),
    );
  });
});
