import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ReaderNavigation, retainedReaderRoute } from '../../entry/src/main/ets/app/navigation/ReaderNavigation.ts';

test('only the admitted detail route can open and return from its directory', () => {
  const navigation = new ReaderNavigation();
  assert.equal(navigation.openDirectory('detail', () => true), undefined);
  navigation.show('detail');
  assert.equal(navigation.openDirectory('detail', () => false), undefined);
  const opened = navigation.openDirectory('detail', () => true);
  assert.equal(opened?.route, 'directory');
  assert.equal(retainedReaderRoute('directory', 'detail'), undefined);
  const destination = navigation.closeDirectory(false, assert.fail);
  assert.equal(destination?.route, 'detail');
  assert.equal(navigation.routeMotion(), 'pop');
});

test('late preparation cannot open a directory after its navigation owner moves', () => {
  const navigation = new ReaderNavigation();
  navigation.show('reading');
  assert.equal(navigation.openDirectory('readerControl', () => { navigation.advance(); return true; }), undefined);
  assert.equal(navigation.snapshot().route, 'reading');
  assert.equal(navigation.openDirectory('readerControl', () => true)?.route, 'directory');
  assert.equal(retainedReaderRoute('directory', 'readerControl'), 'directory');
});
