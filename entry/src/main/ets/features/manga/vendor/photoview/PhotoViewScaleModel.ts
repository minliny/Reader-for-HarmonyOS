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

/** Source-extracted scale policy; native Scroll/List own panning and virtualized pixels. */
export class PhotoViewScaleModel {
  scale: number = 1;
  scaleMin: number = 1;
  scaleMax: number = 3;
  iterations: number = 0;
  animate: boolean = false;
    public setScale(scale: number, animate: boolean): PhotoViewScaleModel {
      this.scale = scale
      if (this.scale < this.scaleMin) {
        this.scale = this.scaleMin
      }
      if (this.scale > this.scaleMax) {
        this.scale = this.scaleMax
      }

      if (animate) {
        this.iterations = 1
      } else {
        this.iterations = 0
      }
      this.animate = animate
      return this
    }

}
