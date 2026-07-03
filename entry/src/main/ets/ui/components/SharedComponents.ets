@Component
export struct MainTabTitleBar {
  @Prop title: string = '';

  build() {
    Row() {
      Text(this.title)
        .fontSize(29)
        .fontWeight(FontWeight.Bold)
        .fontFamily('serif')
        .fontColor('#201B16')
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .layoutWeight(1)
    }
    .width('100%')
    .height(62)
    .padding({ left: 20, right: 20, top: 6 })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
export struct ReaderUiIcon {
  @Prop iconName: string = '';
  @Prop tone: string = 'dark';
  @Prop iconSize: number = 20;

  build() {
    if (this.iconName === 'source-stack') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_source_stack_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_source_stack_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_source_stack_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_source_stack_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else if (this.iconName === 'chevron') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_chevron_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_chevron_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_chevron_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_chevron_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else if (this.iconName === 'search') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_search_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_search_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_search_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_search_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else if (this.iconName === 'filter') {
      Image($r('app.media.bookshelf_icon_filter_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
    } else if (this.iconName === 'check') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_check_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_check_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_check_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_check_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else if (this.iconName === 'rss') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_rss_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_rss_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_rss_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_rss_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else if (this.iconName === 'upload') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_upload_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_upload_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_upload_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_upload_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else if (this.iconName === 'add') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_add_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_add_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_add_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_add_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else if (this.iconName === 'list') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_list_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_list_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_list_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_list_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else if (this.iconName === 'bookmark') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_bookmark_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_bookmark_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_bookmark_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_bookmark_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else if (this.iconName === 'gear') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_gear_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_gear_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_gear_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_gear_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else if (this.iconName === 'bookshelf') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_bookshelf_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_bookshelf_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_bookshelf_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_bookshelf_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else if (this.iconName === 'sync') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_sync_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_sync_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_sync_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_sync_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else if (this.iconName === 'info') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_info_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_info_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_info_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_info_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else if (this.iconName === 'refresh') {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_refresh_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_refresh_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_refresh_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_refresh_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    } else {
      if (this.tone === 'primary') {
        Image($r('app.media.ui_icon_source_primary')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'white') {
        Image($r('app.media.ui_icon_source_white')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else if (this.tone === 'muted') {
        Image($r('app.media.ui_icon_source_muted')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      } else {
        Image($r('app.media.ui_icon_source_dark')).width(this.iconSize).height(this.iconSize).objectFit(ImageFit.Contain)
      }
    }
  }
}

@Component
export struct SectionHeader {
  @Prop title: string = '';
  @Prop detail: string = '';

  build() {
    Column() {
      Text(this.title)
        .fontSize(22)
        .fontWeight(FontWeight.Bold)
        .fontColor('#1A1A1A')
      Text(this.detail)
        .fontSize(13)
        .fontColor('#666666')
        .margin({ top: 4 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .margin({ bottom: 12 })
  }
}
