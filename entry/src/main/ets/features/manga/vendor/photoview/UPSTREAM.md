# PhotoView scale policy

Source: https://gitee.com/openharmony-sig/ohos_photoview
Tag: 2.1.0. Peeled commit: b4273167bf7b87330655f02e9e856fdb1591efa2.
License: Apache-2.0; LICENSE and NOTICE retained.

PhotoViewScaleModel.ts extracts Model.setScale verbatim, renaming only the return class and retaining its referenced defaults. Reader uses native Scroll/List for panning and virtualization. The upstream Image component is intentionally not instantiated: it decodes the full source and cannot satisfy the long-image region budget. Rotation, fling, matrices and standalone image loading are not imported because this integration does not use them.

Reader-specific adaptation maps the viewport origin to stable original-image x/y, changes virtual row dimensions on scale, and limits materialized regions through MangaSessionController. Horizontal mode advances logical images; all regions of each long image remain vertically accessible at every scale. Gesture precedence: native one-finger panning, simultaneous two-finger pinch, explicit page navigation while magnified. No source URL is given to the renderer.
