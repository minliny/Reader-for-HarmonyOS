// UnitTestArkTS requires the conventional test page path even though Reader's
// suite is registered by the Hypium runner. It intentionally renders nothing.
@Entry
@Component
struct UnitTestIndex {
  build() {
    Column().width('100%').height('100%')
  }
}
