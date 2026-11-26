/** Core confirmed group creation before the initial member assignment stopped. */
export class SourceInitialMembershipUnconfirmed extends Error {
  readonly groupId: string;

  constructor(groupId: string) {
    super('分组已创建，所选书源尚未确认加入。');
    this.groupId = groupId;
  }
}
