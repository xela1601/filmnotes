/**
 * Initial filmnotes schema.
 *
 * Field names mirror `packages/domain/src/types.ts` exactly (camelCase); only the
 * id/created/updated system fields follow PocketBase conventions.
 *
 * Design decisions worth remembering:
 *  - References between our own records (`cameraId`, `rollId`, `filterIds`, ...) are plain
 *    text ids, not PocketBase relations: records are created offline and may reference
 *    each other long before they reach the server.
 *  - `owner` is the only real relation (to `users`) and carries the access rules.
 *  - `clientUpdated` holds the client's own `updated` timestamp for last-write-wins sync;
 *    PocketBase's `updated` stays server time.
 *  - `deleted` is a soft-delete marker (null = alive) so deletions can sync too.
 *  - Ids stay PocketBase's 15-char format, which is what `newId()` produces, so clients
 *    send their own `id` on create.
 */

/** list / view / update / delete: only the owner sees and touches their records. */
const OWNER_RULE = '@request.auth.id != "" && owner = @request.auth.id';
/** create: additionally forbid claiming someone else's user id as owner. */
const CREATE_RULE =
  '@request.auth.id != "" && owner = @request.auth.id && @request.body.owner = @request.auth.id';

const text = (name, extra) => ({ name, type: 'text', ...extra });
const num = (name, extra) => ({ name, type: 'number', ...extra });
const bool = (name) => ({ name, type: 'bool' });
const date = (name) => ({ name, type: 'date' });
const json = (name) => ({ name, type: 'json', maxSize: 2000000 });
const select = (name, values) => ({ name, type: 'select', maxSelect: 1, values });

/** Collections in creation order; the down migration deletes them in reverse. */
const COLLECTIONS = [
  {
    name: 'cameras',
    fields: [
      text('make', { required: true }),
      text('model', { required: true }),
      json('aliases'),
      num('year'),
      text('format'),
      text('mount'),
      json('exposureModes'),
      json('shutterSpeedsManual'),
      json('shutterSpeedsAutoExtra'),
      json('bulbOnlyInModes'),
      json('exposureCompensation'),
      json('iso'),
      json('focusModes'),
      json('driveModes'),
      text('flashSync'),
      text('metering'),
      text('notes'),
      json('conditionNotes'),
      json('defaultsForNewFrame'),
    ],
  },
  {
    name: 'lenses',
    fields: [
      text('make', { required: true }),
      text('model', { required: true }),
      num('focalMinMm'),
      num('focalMaxMm'),
      num('maxAperture'),
      num('minAperture'),
      json('apertureValues'),
      num('filterThreadMm'),
      num('minFocusM'),
      text('macroNote'),
      num('weightG'),
      json('defaultFilterIds'),
      text('handheldMinShutter'),
      bool('hasHood'),
    ],
  },
  {
    name: 'filters',
    fields: [
      text('make', { required: true }),
      text('model', { required: true }),
      num('threadMm'),
      text('type'),
      num('exposureFactorEv'),
      select('afCompatible', ['yes', 'no', 'limited']),
      text('warning'),
      text('mountedOnLensId'),
    ],
  },
  {
    name: 'flashes',
    fields: [
      text('make', { required: true }),
      text('model', { required: true }),
      num('guideNumberIso100M'),
      json('powerLevels'),
      json('headPositions'),
      bool('afIlluminator'),
      text('sync'),
      text('notes'),
    ],
  },
  {
    name: 'film_stocks',
    fields: [
      text('name', { required: true }),
      text('maker'),
      num('iso'),
      select('process', ['C41', 'BW', 'E6']),
      bool('color'),
      num('exposures'),
      bool('dxCoded'),
      text('notes'),
    ],
  },
  {
    name: 'rolls',
    fields: [
      text('cameraId', { required: true }),
      text('filmStockId', { required: true }),
      num('isoSet'),
      select('isoSource', ['DX', 'manual']),
      num('exposures'),
      num('pushPullEv'),
      select('status', ['loaded', 'shot', 'at_lab', 'developed', 'archived']),
      date('loadedAt'),
      date('unloadedAt'),
      text('lab'),
      text('notes'),
    ],
  },
  {
    name: 'frames',
    fields: [
      text('rollId', { required: true }),
      num('frameNo'),
      date('takenAt'),
      text('lensId'),
      num('focalLengthMm'),
      text('exposureMode'),
      text('shutterSpeed'),
      num('aperture'),
      num('exposureCompensationEv'),
      bool('programShift'),
      bool('aeLock'),
      text('focusMode'),
      text('afResult'),
      text('driveMode'),
      text('flashId'),
      text('flashHead'),
      text('flashPower'),
      bool('flashOk'),
      json('filterIds'),
      bool('lensHood'),
      text('support'),
      bool('beepWarning'),
      text('light'),
      text('subject'),
      json('location'),
      text('notes'),
    ],
    extraIndexes: [['rollId']],
  },
  {
    name: 'scans',
    fields: [
      text('rollId', { required: true }),
      text('frameId'),
      text('fileName', { required: true }),
      num('sortIndex'),
      {
        name: 'file',
        type: 'file',
        maxSelect: 1,
        maxSize: 52428800, // 50 MB, lab scans of 135 frames stay well below that
        mimeTypes: ['image/jpeg', 'image/png', 'image/tiff', 'image/webp'],
        thumbs: ['200x200', '800x0'],
      },
      num('width'),
      num('height'),
      date('importedAt'),
    ],
    extraIndexes: [['rollId'], ['frameId']],
  },
  {
    name: 'export_logs',
    fields: [
      text('frameId', { required: true }),
      text('target', { required: true }),
      text('externalId'),
      text('url'),
      date('exportedAt'),
    ],
    extraIndexes: [['frameId']],
  },
];

/** Sync bookkeeping every collection carries, appended after the domain fields. */
function syncFields(usersCollectionId) {
  return [
    date('deleted'),
    date('clientUpdated'),
    {
      name: 'owner',
      type: 'relation',
      collectionId: usersCollectionId,
      maxSelect: 1,
      cascadeDelete: true,
    },
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ];
}

function indexStatements(name, extraIndexes) {
  return [['owner'], ...(extraIndexes || [])].map(
    (columns) =>
      'CREATE INDEX `idx_' +
      name +
      '_' +
      columns.join('_') +
      '` ON `' +
      name +
      '` (' +
      columns.map((column) => '`' + column + '`').join(', ') +
      ')',
  );
}

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users');

    for (const spec of COLLECTIONS) {
      const collection = new Collection({
        type: 'base',
        name: spec.name,
        fields: [...spec.fields, ...syncFields(users.id)],
        listRule: OWNER_RULE,
        viewRule: OWNER_RULE,
        createRule: CREATE_RULE,
        updateRule: OWNER_RULE,
        deleteRule: OWNER_RULE,
        indexes: indexStatements(spec.name, spec.extraIndexes),
      });
      app.save(collection);
    }
  },
  (app) => {
    for (const spec of [...COLLECTIONS].reverse()) {
      app.delete(app.findCollectionByNameOrId(spec.name));
    }
  },
);
