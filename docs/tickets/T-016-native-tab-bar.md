# T-016 – Native tab bar (Liquid Glass on iOS 26, Material 3 on Android)

**Wave:** backlog — ready to start, one decision open
**Depends on:** nothing. It replaces one file.
**Owns:** `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/e2e/jsdomApp.mjs`,
`apps/mobile/e2e/tour.mjs`, `apps/mobile/e2e/screenshots.mjs`

**Goal:** The three tabs are rendered by the platform instead of drawn by us — a real
`UITabBarController` on iOS and a real Material tab bar on Android. On iOS 26 that means the bar
_is_ Liquid Glass, it minimises while a long roll is scrolled, and it behaves like every other app
on the phone. None of that can be faked convincingly, and all of it would have to be maintained
against each OS release if we tried.

## Why it is not already done

It was written and it type-checks; the implementation is at the bottom of this ticket. Two things
stopped it, both found by running it rather than by reading:

1. **The web build drops the test ids.** `expo-router`'s web implementation of `NativeTabs`
   renders `react-tabs` (`TabsList aria-label="Main"`, see
   `node_modules/expo-router/build/native-tabs/NativeTabsView.web.js`) and does not pass `testID`
   through to the tab buttons, although `NativeTabTriggerProps` accepts one. `mise run check:tour`
   therefore fails on the two scenes that switch tabs:

   ```
   FAIL 11-equipment – timeout waiting for tab-equipment
   FAIL 12-settings  – timeout waiting for tab-settings
   ```

   Everything else in the tour passes, so the bar itself does render on web — only its buttons are
   unreachable by test id.

2. **The appearance cannot be checked from the development sandbox.** There is no simulator and no
   device here, and `NativeTabs` is a native component: seeing it needs `npx expo run:ios` on a
   machine with Xcode. Whether it renders at all under Expo Go without a native rebuild is
   likewise unverified.

## The decision

How should the guided tour reach a tab once the bar is the platform's?

- **(a) Navigate by route.** Give the jsdom and Playwright drivers a `navigate("/equipment")` and
  use it in the two scenes instead of `press("tab-equipment")`. Honest about what it tests: the
  tab bar on web is a third-party component we do not control anyway. _Proposed._
- **(b) Press by accessible name.** Keep pressing, but find the button by its label through the
  accessibility tree, which both drivers can do. Closer to what a person does; brittle against
  translation, since the tour runs in English and the labels come from i18n.
- **(c) Keep the tab bar we draw ourselves.** The current `Tabs` works everywhere and is fully
  testable, and no Liquid Glass.

## Steps

- [ ] **Step 1: the driver.** Add `navigate(path)` to `e2e/jsdomApp.mjs` and to the Playwright
      driver in `e2e/screenshots.mjs`, so both satisfy the same interface `e2e/tour.mjs` uses.
      Test: the existing tour still passes with `press` untouched.
- [ ] **Step 2: the two scenes.** Switch `11-equipment` and `12-settings` in `e2e/tour.mjs` to
      `navigate`. `mise run check:tour` green.
- [ ] **Step 3: the layout.** Put the implementation below into
      `apps/mobile/app/(tabs)/_layout.tsx`. `npm run typecheck`, `mise run check:web`,
      `mise run check:tour` green.
- [ ] **Step 4: look at it.** `npx expo run:ios` on the Mac, on an iOS 26 simulator: the bar is
      glass, it minimises on scroll down, the selected tint follows the chosen theme. Then
      `npx expo run:android`. **This step cannot be done in the sandbox.**
- [ ] **Step 5: screenshots.** Regenerate `docs/screenshots/` — the tab bar changes in every one
      of them. Commit `feat(app): the platform draws the tab bar`.

**Done when:** the full gate is green, and the bar has been seen on both platforms.

## Risks

- **The API is `unstable_`.** `expo-router/unstable-native-tabs` may change its import path or its
  props between SDK versions. It is one file, and the fallback is the `Tabs` we have now.
- **No opaque background.** Setting `backgroundColor` on the bar switches the glass off, so the
  custom themes deliberately tint only the selection. On the darkroom theme the bar will be
  brighter than the app — decide when you see it.

## The implementation, as it stood

```tsx
import { Ionicons } from "@expo/vector-icons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../src/ui";

const { Trigger } = NativeTabs;

export default function TabsLayout() {
  const { t } = useTranslation();
  const { palette } = useTheme();

  return (
    <NativeTabs
      tintColor={palette.primary}
      iconColor={{ default: palette.textMuted, selected: palette.primary }}
      minimizeBehavior="onScrollDown"
    >
      <Trigger name="index" testID="tab-rolls">
        <Trigger.Label>{t("tabs.rolls")}</Trigger.Label>
        <Trigger.Icon src={<Trigger.VectorIcon family={Ionicons} name="film-outline" />} />
      </Trigger>
      <Trigger name="equipment" testID="tab-equipment">
        <Trigger.Label>{t("tabs.equipment")}</Trigger.Label>
        <Trigger.Icon src={<Trigger.VectorIcon family={Ionicons} name="camera-outline" />} />
      </Trigger>
      <Trigger name="settings" testID="tab-settings">
        <Trigger.Label>{t("tabs.settings")}</Trigger.Label>
        <Trigger.Icon src={<Trigger.VectorIcon family={Ionicons} name="settings-outline" />} />
      </Trigger>
    </NativeTabs>
  );
}
```

`expo-glass-effect` (already installed, 57.0.3) exposes `GlassView` and `isLiquidGlassAvailable()`
for glass surfaces we draw ourselves — a toolbar, an overlay. Worth a separate ticket once the bar
is settled and there is something to compare against.
