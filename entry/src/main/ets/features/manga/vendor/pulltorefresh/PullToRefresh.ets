/*
 * Copyright (C) 2022 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Reader modification (2026-10-08): explicit single-finger edge admission,
// short-content support, raw trigger distance, a stable translated viewport,
// cancellation and async lifetime guards. Original five-stage damping retained.
import { PullToRefreshConfigurator } from './PullToRefreshConfigurator';

export type PullDirection = 'previous' | 'next' | '';
const IS_FREE = 0;
const IS_PULL_DOWN_1 = 11;
const IS_PULL_DOWN_2 = 12;
const IS_REFRESHING = 2;
const IS_PULL_UP_1 = 41;
const IS_PULL_UP_2 = 42;
const IS_LOADING = 5;

@Component
export struct PullToRefresh {
  scroller: Scroller = new Scroller();
  @BuilderParam customList: () => void;
  @BuilderParam customRefresh?: () => void;
  @BuilderParam customLoad?: () => void;
  @Prop @Watch('handleEnabledChange') pullEnabled: boolean = true;
  @Prop @Watch('handleAdmissionChange') hasPrevious: boolean = true;
  @Prop @Watch('handleAdmissionChange') hasNext: boolean = true;
  @Prop @Watch('handleResetToken') resetToken: number = 0;
  @Prop animationDuration: number = 180;
  onPull: (direction: PullDirection, distance: number, armed: boolean) => void = () => {};
  onActivity: (active: boolean) => void = () => {};
  onRefresh: () => Promise<string> = async () => '';
  onLoadMore: () => Promise<string> = async () => '';
  mWidth: Length = '100%';
  mHeight: Length = '100%';
  private refreshConfigurator: PullToRefreshConfigurator = new PullToRefreshConfigurator()
    .setMaxTranslate(170).setSensitivity(0.7).setAnimDuration(180).setListIsPlacement(true);
  @State private mHeightNumber: number = 0;
  @State private trYTop: number = 0;
  @State private trYBottom: number = 0;
  @State private state: number = IS_FREE;
  private touchYOld: number = 0;
  @State private rawDistance: number = 0;
  private topSince: number = 0;
  private bottomSince: number = 0;
  private atTop: boolean = false;
  private atBottom: boolean = false;
  private gestureCancelled: boolean = false;
  private requestPending: boolean = false;
  private requestGeneration: number = 0;
  private alive: boolean = false;
  private active: boolean = false;
  private panOption: PanGestureOptions = new PanGestureOptions({
    fingers: 1, direction: PanDirection.Up | PanDirection.Down, distance: 1
  });

  aboutToAppear(): void { this.alive = true; }

  aboutToDisappear(): void {
    this.alive = false;
    this.requestGeneration++;
    this.requestPending = false;
    this.gestureCancelled = true;
    this.resetPull(false);
  }

  private handleEnabledChange(): void {
    if (!this.pullEnabled) this.cancelPull();
  }

  private handleAdmissionChange(): void {
    if ((this.pullDirection() === 'previous' && !this.hasPrevious) ||
      (this.pullDirection() === 'next' && !this.hasNext)) this.cancelPull();
  }

  private handleResetToken(): void { this.cancelPull(); }

  private triggerDistance(): number {
    return Math.max(120, Math.min(180, this.mHeightNumber * 0.2));
  }

  private pullDirection(): PullDirection {
    if (this.state === IS_PULL_DOWN_1 || this.state === IS_PULL_DOWN_2 || this.state === IS_REFRESHING) return 'previous';
    if (this.state === IS_PULL_UP_1 || this.state === IS_PULL_UP_2 || this.state === IS_LOADING) return 'next';
    return '';
  }

  private setActive(active: boolean): void {
    if (this.active === active) return;
    this.active = active;
    this.onActivity(active);
  }

  private emitPull(): void {
    this.onPull(this.rawDistance >= 24 ? this.pullDirection() : '', this.rawDistance,
      this.rawDistance >= this.triggerDistance());
  }

  private updateBoundary(now: number): void {
    try {
      const offset: OffsetResult = this.scroller.currentOffset();
      this.atTop = Math.abs(offset.yOffset) < 0.001;
      // Unlike upstream 2.1.1, isAtEnd is authoritative even at yOffset=0.
      this.atBottom = this.scroller.isAtEnd();
    } catch (_) {
      this.atTop = false;
      this.atBottom = false;
    }
    this.topSince = this.atTop ? (this.topSince === 0 ? now : this.topSince) : 0;
    this.bottomSince = this.atBottom ? (this.bottomSince === 0 ? now : this.bottomSince) : 0;
  }

  private onActionStart(event: GestureEvent): void {
    this.gestureCancelled = !this.pullEnabled || this.requestPending || event.fingerList.length > 1;
    this.touchYOld = event.offsetY;
    this.topSince = 0;
    this.bottomSince = 0;
    this.updateBoundary(Date.now());
  }

  private handleTouchEvent(event: TouchEvent): void {
    if (event.type === TouchType.Down && event.touches.length === 1 && !this.requestPending) {
      this.gestureCancelled = !this.pullEnabled;
    }
    if (event.type === TouchType.Cancel || event.touches.length > 1) this.cancelPull();
  }

  private onActionUpdate(event: GestureEvent): void {
    const delta = event.offsetY - this.touchYOld;
    this.touchYOld = event.offsetY;
    if (!this.pullEnabled || this.gestureCancelled || this.requestPending) return;
    if (event.fingerList.length > 1) { this.cancelPull(); return; }
    const now = Date.now();
    this.updateBoundary(now);
    if (this.state === IS_FREE) {
      // Distance before the boundary has remained stable is never included.
      if (delta > 0 && this.hasPrevious && this.atTop && this.topSince > 0 && now - this.topSince >= 100) {
        this.state = IS_PULL_DOWN_1;
      } else if (delta < 0 && this.hasNext && this.atBottom && this.bottomSince > 0 && now - this.bottomSince >= 100) {
        this.state = IS_PULL_UP_1;
      } else return;
      this.rawDistance = 0;
      this.setActive(true);
    }
    const direction = this.pullDirection();
    const signed = direction === 'previous' ? delta : -delta;
    this.rawDistance = Math.max(0, this.rawDistance + signed);
    if (this.rawDistance === 0) { this.cancelPull(); return; }
    // Retain upstream damping and edge pinning while reversing an active pull.
    if (direction === 'previous') {
      this.scroller.scrollEdge(Edge.Top);
      this.trYTop = this.getTranslateYOfRefresh(delta);
      this.state = this.rawDistance >= this.triggerDistance() ? IS_PULL_DOWN_2 : IS_PULL_DOWN_1;
    } else {
      this.scroller.scrollEdge(Edge.Bottom);
      this.trYBottom = this.getTranslateYOfLoadMore(delta);
      this.state = this.rawDistance >= this.triggerDistance() ? IS_PULL_UP_2 : IS_PULL_UP_1;
    }
    this.emitPull();
  }

  private onActionEnd(): void {
    if (!this.pullEnabled || this.gestureCancelled || this.requestPending || this.state === IS_FREE) return;
    if (this.rawDistance < this.triggerDistance()) { this.resetPull(true); return; }
    const direction = this.pullDirection();
    if ((direction === 'previous' && !this.hasPrevious) || (direction === 'next' && !this.hasNext)) {
      this.cancelPull(); return;
    }
    this.requestPending = true;
    const generation = ++this.requestGeneration;
    if (direction === 'previous') { this.state = IS_REFRESHING; this.trYTop = 96; }
    else { this.state = IS_LOADING; this.trYBottom = -96; }
    this.emitPull();
    this.runRequest(direction, generation);
  }

  private async runRequest(direction: PullDirection, generation: number): Promise<void> {
    try {
      if (direction === 'previous') await this.onRefresh();
      else await this.onLoadMore();
    } catch (_) {
      // Caller owns the chapter failure message. Both success and rejection reset.
    } finally {
      if (this.alive && generation === this.requestGeneration) {
        this.requestPending = false;
        this.resetPull(true);
      }
    }
  }

  private cancelPull(): void {
    this.gestureCancelled = true;
    this.requestGeneration++;
    this.requestPending = false;
    this.resetPull(this.alive);
  }

  private resetPull(animated: boolean): void {
    const reset = (): void => { this.trYTop = 0; this.trYBottom = 0; };
    if (animated) animateTo({ duration: Math.max(0, this.animationDuration) }, reset);
    else reset();
    this.state = IS_FREE;
    this.rawDistance = 0;
    this.onPull('', 0, false);
    this.setActive(false);
  }

  build() {
    Stack({ alignContent: Alignment.Top }) {
      Stack() {
        if (this.customRefresh !== undefined) this.customRefresh();
      }
      .width('100%')
      .height(this.trYTop)
      .align(Alignment.Top)
      .clip(true)
      .visibility(this.rawDistance >= 24 || this.state === IS_REFRESHING ? Visibility.Visible : Visibility.Hidden)
      .hitTestBehavior(HitTestMode.None)
      Column() { this.customList(); }
      .width('100%')
      .height('100%')
      .translate({ y: this.trYTop + this.trYBottom })
      Stack() {
        if (this.customLoad !== undefined) this.customLoad();
      }
      .width('100%')
      .height(-this.trYBottom)
      .align(Alignment.Bottom)
      .clip(true)
      .visibility(this.rawDistance >= 24 || this.state === IS_LOADING ? Visibility.Visible : Visibility.Hidden)
      .hitTestBehavior(HitTestMode.None)
    }
    .width(this.mWidth)
    .height(this.mHeight)
    .clip(true)
    .onAreaChange((oldValue: Area, newValue: Area): void => {
      const height = Number(newValue.height);
      if (this.mHeightNumber > 0 && this.mHeightNumber !== height) this.cancelPull();
      this.mHeightNumber = height;
    })
    .onTouch((event: TouchEvent): void => this.handleTouchEvent(event))
    .parallelGesture(
      PanGesture(this.panOption)
        .onActionStart((event: GestureEvent): void => this.onActionStart(event))
        .onActionUpdate((event: GestureEvent): void => this.onActionUpdate(event))
        .onActionEnd((): void => this.onActionEnd())
        .onActionCancel((): void => this.cancelPull())
    )
  }
  private getTranslateYOfRefresh(newTranslateY: number): number {
    if (this.refreshConfigurator !== undefined) {
      let maxTranslateY = this.refreshConfigurator.getMaxTranslate();
      let sensitivity = this.refreshConfigurator.getSensitivity();
      if (maxTranslateY !== undefined && sensitivity !== undefined && this.trYTop !== undefined) {
        // 阻尼值计算
        if (this.trYTop / maxTranslateY < 0.2) {
          newTranslateY = newTranslateY * 1 * sensitivity;
        } else if (this.trYTop / maxTranslateY < 0.4) {
          newTranslateY = newTranslateY * 0.8 * sensitivity;
        } else if (this.trYTop / maxTranslateY < 0.6) {
          newTranslateY = newTranslateY * 0.6 * sensitivity;
        } else if (this.trYTop / maxTranslateY < 0.8) {
          newTranslateY = newTranslateY * 0.4 * sensitivity;
        } else {
          newTranslateY = newTranslateY * 0.2 * sensitivity;
        }
        // 下拉值计算
        if (this.trYTop + newTranslateY > maxTranslateY) {
          return maxTranslateY;
        } else if (this.trYTop + newTranslateY < 0) {
          return 0;
        } else {
          return this.trYTop + newTranslateY;
        }
      }
    }
    return 0;
  }

  private getTranslateYOfLoadMore(newTranslateY: number): number {
    if (this.refreshConfigurator !== undefined) {
      let maxTranslateY = this.refreshConfigurator.getMaxTranslate();
      let sensitivity = this.refreshConfigurator.getSensitivity();
      if (maxTranslateY !== undefined && sensitivity !== undefined && this.trYBottom !== undefined) {
        // 阻尼值计算
        if (this.trYBottom / maxTranslateY > -0.2) {
          newTranslateY = newTranslateY * 1 * sensitivity;
        } else if (this.trYBottom / maxTranslateY > -0.4) {
          newTranslateY = newTranslateY * 0.8 * sensitivity;
        } else if (this.trYBottom / maxTranslateY > -0.6) {
          newTranslateY = newTranslateY * 0.6 * sensitivity;
        } else if (this.trYBottom / maxTranslateY > -0.8) {
          newTranslateY = newTranslateY * 0.4 * sensitivity;
        } else {
          newTranslateY = newTranslateY * 0.2 * sensitivity;
        }
        // 下拉值计算
        if (this.trYBottom + newTranslateY < -maxTranslateY) {
          return -maxTranslateY;
        } else if (this.trYBottom + newTranslateY > 0) {
          return 0;
        } else {
          return this.trYBottom + newTranslateY;
        }
      }
    }
    return 0;
  }

}
