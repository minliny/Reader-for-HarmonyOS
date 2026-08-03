// Blank page for the default-target MainAbility. The real test surface is the
// ohosTest TestAbility; this page only exists so the default HAP loads.
@Entry
@Component
struct Index {
  build() {
    Column() {
      Text('pageturn_tests')
        .fontSize(16)
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}
