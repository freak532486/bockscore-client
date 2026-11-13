export interface Component {

    /**
     * The HTML-Element that represents this component.
     */
    readonly view: HTMLElement;

    /**
     * Called whenever the component becomes visible as a tab.
     */
    onShow?(): void;
};