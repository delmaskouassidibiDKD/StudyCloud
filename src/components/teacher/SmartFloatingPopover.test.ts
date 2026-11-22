import test from 'node:test';
import assert from 'node:assert/strict';
import { computeSmartPopoverPosition } from './SmartFloatingPopover.tsx';

test('First school-year pill next to left sidebar never enters sidebar and clears pill', () => {
  // Exact layout from user screenshot: left sidebar ends at x=210, safeLeft=222
  const safe = { left: 222, top: 76, right: 1268, bottom: 788, width: 1046, height: 712 };
  const pill = { left: 232, top: 144, right: 392, bottom: 180, width: 160, height: 36 };
  const trigger = { left: 360, top: 150, right: 384, bottom: 174, width: 24, height: 24 };

  const pos = computeSmartPopoverPosition({
    anchor: trigger,
    avoid: pill,
    safe,
    popW: 224,
    popH: 128,
    preferredSide: 'bottom',
    preferredAlign: 'start',
    gap: 8,
  });

  // Must NEVER enter the left sidebar
  assert.ok(pos.left >= safe.left, `Expected left (${pos.left}) >= safe.left (${safe.left})`);
  // Must stay strictly inside right edge
  assert.ok(pos.left + 224 <= safe.right, 'Must not overflow right edge');
  // Must sit cleanly below the entire pill without overlapping the 2026 - 2027 text
  assert.ok(pos.top >= pill.bottom + 8, `Expected top (${pos.top}) >= pill.bottom + 8 (${pill.bottom + 8})`);
  assert.equal(pos.placement, 'bottom-start');
  assert.equal(pos.caretSide, 'top');
});

test('Right-edge card menu automatically flips leftward (bottom-end) to avoid right clipping', () => {
  const safe = { left: 222, top: 76, right: 1268, bottom: 788, width: 1046, height: 712 };
  const trigger = { left: 1220, top: 210, right: 1248, bottom: 238, width: 28, height: 28 };

  const pos = computeSmartPopoverPosition({
    anchor: trigger,
    avoid: null,
    safe,
    popW: 224,
    popH: 128,
    preferredSide: 'bottom',
    preferredAlign: 'start',
    gap: 8,
  });

  assert.equal(pos.placement, 'bottom-end');
  assert.ok(pos.left + 224 <= safe.right, 'Must stay inside right edge');
  assert.ok(pos.left >= safe.left, 'Must stay inside left edge');
  assert.equal(pos.caretSide, 'top');
});

test('Bottom-edge trigger automatically flips above (top-start) to avoid bottom clipping', () => {
  const safe = { left: 222, top: 76, right: 1268, bottom: 788, width: 1046, height: 712 };
  const trigger = { left: 400, top: 740, right: 424, bottom: 764, width: 24, height: 24 };

  const pos = computeSmartPopoverPosition({
    anchor: trigger,
    avoid: null,
    safe,
    popW: 224,
    popH: 160,
    preferredSide: 'bottom',
    preferredAlign: 'start',
    gap: 8,
  });

  assert.equal(pos.placement, 'top-start');
  assert.ok(pos.top + 160 <= trigger.top, 'Must open completely above trigger');
  assert.ok(pos.top >= safe.top, 'Must stay inside top edge');
  assert.equal(pos.caretSide, 'bottom');
});

test('Bottom-right corner trigger flips to top-end cleanly', () => {
  const safe = { left: 222, top: 76, right: 1268, bottom: 788, width: 1046, height: 712 };
  const trigger = { left: 1220, top: 740, right: 1248, bottom: 768, width: 28, height: 28 };

  const pos = computeSmartPopoverPosition({
    anchor: trigger,
    avoid: null,
    safe,
    popW: 224,
    popH: 160,
    preferredSide: 'bottom',
    preferredAlign: 'start',
    gap: 8,
  });

  assert.equal(pos.placement, 'top-end');
  assert.ok(pos.left + 224 <= safe.right);
  assert.ok(pos.top + 160 <= trigger.top);
  assert.equal(pos.caretSide, 'bottom');
});

test('Tall gradebook menu with expanded color palette shifts to side when neither top nor bottom fits', () => {
  const safe = { left: 12, top: 60, right: 1268, bottom: 680, width: 1256, height: 620 };
  const trigger = { left: 320, top: 350, right: 344, bottom: 374, width: 24, height: 24 };

  const pos = computeSmartPopoverPosition({
    anchor: trigger,
    avoid: null,
    safe,
    popW: 224,
    popH: 410,
    preferredSide: 'bottom',
    preferredAlign: 'start',
    gap: 6,
  });

  // Neither top (350 - 60 = 290 < 410) nor bottom (680 - 374 = 306 < 410) fits vertically -> must move to side!
  assert.equal(pos.placement, 'right-start');
  assert.ok(pos.left >= trigger.right + 6, 'Must clear trigger to the right');
  assert.ok(pos.top >= safe.top && pos.top + 410 <= safe.bottom, 'Must fit vertically inside safe bounds');
  assert.equal(pos.caretSide, 'left');
});

test('Create-year top-right dropdown stays inside safe bounds even on narrow screen', () => {
  const safe = { left: 12, top: 60, right: 363, bottom: 600, width: 351, height: 540 };
  const trigger = { left: 170, top: 90, right: 355, bottom: 122, width: 185, height: 32 };

  const pos = computeSmartPopoverPosition({
    anchor: trigger,
    avoid: null,
    safe,
    popW: 320,
    popH: 340,
    preferredSide: 'bottom',
    preferredAlign: 'end',
    gap: 10,
  });

  assert.ok(pos.left >= safe.left, 'Must never clip off left edge on mobile');
  assert.ok(pos.left + 320 <= safe.right, 'Must never clip off right edge on mobile');
  assert.ok(pos.top >= trigger.bottom + 10);
});

test('Add-term side popover opens cleanly to the right of + Trimestre when space allows', () => {
  const safe = { left: 222, top: 76, right: 1268, bottom: 788, width: 1046, height: 712 };
  const trigger = { left: 234, top: 420, right: 350, bottom: 456, width: 116, height: 36 };

  const pos = computeSmartPopoverPosition({
    anchor: trigger,
    avoid: null,
    safe,
    popW: 280,
    popH: 210,
    preferredSide: 'right',
    preferredAlign: 'start',
    gap: 10,
  });

  assert.equal(pos.placement, 'right-start');
  assert.ok(pos.left >= trigger.right + 10);
  assert.equal(pos.caretSide, 'left');
});
