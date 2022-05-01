import { View, Layout } from "../equal-lib";
import { EnvService } from "../equal-services";
import _EnvService from "../EnvService";

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

        this.init();
    }

    private async init() {
        var S4 = () => (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        // generate a random guid
        this.id = (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
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

    public change(value:any) {
        this.setValue(value);
    }

    /**
     * @return always returns a JQuery object
     */
    public render(): JQuery {
        return this.$elem;
    }

    public attach(): JQuery {        
        this.$elem = $('<div/>').addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());
        return this.$elem;
    }
    
}