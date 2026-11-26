/** Native actors can outlive a route. Sample the opening when they dispatch
 * an event and keep that opening for work completed after an animation. */
export class BookshelfInputAdmission {
  private readonly generation: () => number;
  private readonly interactive: (navigation: number) => boolean;

  constructor(generation: () => number, interactive: (navigation: number) => boolean) {
    this.generation = generation;
    this.interactive = interactive;
  }

  begin(): number | undefined {
    const navigation = this.generation();
    return this.interactive(navigation) ? navigation : undefined;
  }

  isCurrent(opening: number): boolean {
    return opening === this.generation() && this.interactive(opening);
  }
}
