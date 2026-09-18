/**
 * Route `/frames/[frameId]` – the frame capture & edit screen.
 *
 * Reached from the roll detail screen, but usable standalone: the screen reads the frame id
 * from the route parameters itself. Test lives next to the screen in `src/features/frames`,
 * because expo-router would turn a test file in this directory into a route.
 */
import { FrameEditScreen } from '../../src/features/frames/FrameEditScreen';

export default function FrameRoute() {
  return <FrameEditScreen />;
}
