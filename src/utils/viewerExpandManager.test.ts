import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getViewerExpandLevel,
  resetViewerExpand,
  setViewerExpandLevel,
  subscribeViewerExpandLevel,
} from './viewerExpandManager';

test('viewerExpandManager synchronise atomiquement le niveau entre enfants et parents sans perte de mise à jour', () => {
  resetViewerExpand();
  assert.equal(getViewerExpandLevel(), 0);

  // Scénario exact du bug : un enfant restaure level=2 AVANT que le parent (FoldersView) s'abonne
  let childNotifications = 0;
  const unsubChild = subscribeViewerExpandLevel(() => {
    childNotifications += 1;
  });

  setViewerExpandLevel(2);
  assert.equal(getViewerExpandLevel(), 2);
  assert.equal(childNotifications, 1);

  // Le parent s'abonne ensuite (useSyncExternalStore relit getViewerExpandLevel() immédiatement)
  let parentNotifications = 0;
  const unsubParent = subscribeViewerExpandLevel(() => {
    parentNotifications += 1;
  });
  assert.equal(getViewerExpandLevel(), 2);

  // Les transitions ultérieures (2 -> 1 -> 0) notifient tous les abonnés
  setViewerExpandLevel(1);
  assert.equal(getViewerExpandLevel(), 1);
  assert.equal(childNotifications, 2);
  assert.equal(parentNotifications, 1);

  // Même niveau répété -> aucune notification inutile
  setViewerExpandLevel(1);
  assert.equal(childNotifications, 2);
  assert.equal(parentNotifications, 1);

  resetViewerExpand();
  assert.equal(getViewerExpandLevel(), 0);
  assert.equal(childNotifications, 3);
  assert.equal(parentNotifications, 2);

  unsubChild();
  unsubParent();
});
