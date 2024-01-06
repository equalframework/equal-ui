import { View, Layout } from "../equal-lib";
import { EnvService } from "../equal-services";
import _EnvService from "../EnvService";

/**
 * This singleton is used to increase speed of UUID generation by using pseudo random values,
 * plus a manual increment the last 8 hexadecimal digits.
 *
 * Notes:
 * - This implies a capacity of 4G distinct UUID in a same App.
 * - Each time the app is reloaded, all UUID are re-generated.
 */
class UuidProvider {
    private static instance: UuidProvider;
    private index: number;
    private base: string;

    private constructor() {
        this.index = 1;
        // generates a random 4 hexadecimal digits string
        let S4 = () => (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        // generate a random uuid with 26 hexadecimal digits (last 8 digits are omitted)
        // 92867eb7-604f-5764-41d6-d0bd
        this.base = (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4());
    }

    public static getInstance(): UuidProvider {
        if(!UuidProvider.instance) {
            UuidProvider.instance = new UuidProvider();
        }
        return UuidProvider.instance;
    }

    public getUuid() {
        let S4 = () => (this.index++).toString(16).padStart(8, '0');
        return this.base+S4();
    }
}

export default class Widget {

    private layout: Layout;

    protected $elem: JQuery;

    protected value: any;
    protected label: string;
    protected type: string;
    protected is_first: boolean;

    protected mode: string = '';
    protected id: string = '';

    protected readonly: boolean = false;

    protected config: any;

    constructor(layout: Layout, type: string, label: string, value: any, config: any) {
        this.layout = layout;

        this.is_first = false;
        this.value = value;
        this.label = label;
        this.type = type;
        this.config = config;
        // assign default mode
        this.mode = 'view';

        this.$elem = $();
        // generate a pseudo-random guid
        this.id = UuidProvider.getInstance().getUuid();
    }

    protected getLayout() {
        return this.layout;
    }

    public getId() {
        return this.id;
    }

    public getElement() {
        return this.$elem;
    }

    public getValue() {
        return this.value;
    }

    public getLabel() {
        return this.label;
    }

    public getType() {
        return this.type;
    }

    public getMode() {
        return this.mode;
    }

    public getConfig() {
        return this.config;
    }

    public setIsFirst(is_first: boolean) {
        this.is_first = is_first;
    }

    public setValue(value: any) {
        this.value = value;
        return this;
    }

    public setLabel(label: string) {
        this.label = label;
        return this;
    }

    public setType(type: string) {
        this.type = type;
        return this;
    }

    public setMode(mode: string) {
        this.mode = mode;
        return this;
    }

    public setReadonly(readonly: boolean) {
        this.readonly = readonly;
        return this;
    }

    public setConfig(config:any) {
        this.config = config;
        return this;
    }

    /**
     *
     * This method is called by LayoutList for setting a widget with bulk assign.
     * @param value
     */
    public change(value:any) {
        this.setValue(value);
    }

    /**
     * This method is meant to be overloaded by children classes (which might optionally call this parent method).
     * @return always returns a JQuery object
     */
    public render(): JQuery {
        return this.$elem.addClass('sb-widget').attr('data-type', this.config.type).attr('data-usage', this.config.usage||'');
    }

    public attach(): JQuery {
        this.$elem = $('<div/>').addClass('sb-widget').attr('data-type', this.config.type).attr('data-usage', this.config.usage||'').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());
        return this.$elem;
    }

}