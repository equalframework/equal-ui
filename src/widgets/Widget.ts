import { View, Layout } from "../equal-lib";
import moment from 'moment/moment.js';
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
        let S8 = () => (this.index++).toString(16).padStart(8, '0');
        return this.base + S8();
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
    // meta data, if any (used for files)
    protected meta: any;

    constructor(layout: Layout, label: string, value: any, config: any) {
        this.layout = layout;

        this.is_first = false;
        this.value = value;
        this.label = label;
        this.type = config.type ?? 'string';
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

    public getMeta() {
        return this.meta;
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

    public setConfig(config: any) {
        console.debug('Widget::setConfig', this.type, config);
        this.config = config;
        return this;
    }

    public setMeta(meta: any) {
        this.meta = meta;
        return this;
    }

    /**
     * Method meant to be overridden by widgets, for updating the displayed value.
     * This method is called by LayoutList for setting a widget with bulk assign.
     * @param value
     */
    public change(value:any) {
        this.setValue(value);
    }

    /**
     * Return the text representation of the value based on Widget type.
     *
     * @return string
     */
    public toString(): string {
        return Widget.toString(this.config.type, this.value, this.config?.usage ?? null);
    }

    /**
     * This method is meant to be enriched by children classes (which might optionally call this parent method).
     *
     * @returns {JQuery}    Returns a JQuery object.
     */
    public render(): JQuery {
        return this.$elem
            .addClass('sb-widget')
            .attr('data-field', this.config.field)
            .attr('data-type', this.config.type)
            .attr('data-usage', this.config.usage || '');
    }

    public attach(): JQuery {
        this.$elem = $('<div/>')
            .addClass('sb-widget')
            .addClass('sb-widget-mode-' + this.mode)
            .attr('data-field', this.config.field)
            .attr('data-type', this.config.type)
            .attr('data-usage', this.config.usage || '')
            .attr('id', this.getId());
        return this.$elem;
    }

    public static toString(type: string, value: any, usage?: string | null): string {
        console.debug("Widget::toString - parsing value", type, value, usage);
        switch(type) {
            case 'time':
                return Widget.formatTime(value, usage);
            case 'date':
                return Widget.formatDate(value, usage);
            case 'datetime':
                return Widget.formatDateTime(value, usage);
            case 'integer':
                return Widget.formatInteger(value, usage);
            case 'float':
                return Widget.formatFloat(value, usage);
        }
        return String(value);
    }

    private static formatFloat(value: any, usage?: string | null): string {
        let result: string = '';
        let parsedValue = Number(value);
        if(value !== null && value !== undefined && !Number.isNaN(parsedValue)) {
            result = EnvService.formatNumber(parsedValue);
            if(usage) {
                if(usage.indexOf('amount/percent') >= 0 || usage.indexOf('amount/rate') >= 0) {
                    result = (parsedValue * 100).toFixed(0) + '%';
                }
                else if(usage.indexOf('amount/money') >= 0) {
                    result = EnvService.formatCurrency(parsedValue);
                }
                else if(usage.indexOf('number/real') >= 0) {
                    const match = usage.match(/number\/real:(\d+(\.\d+)?)/);
                    // by default use environment setting
                    let precision: number = -1;
                    if(match) {
                        const number_parts = match[1].split('.');
                        precision = parseInt(number_parts.length >= 2 ? number_parts[1] : number_parts[0], 10);
                    }
                    result = EnvService.formatNumber(parsedValue, precision);
                }
            }
        }
        return result;
    }

    private static formatInteger(value: any, usage?: string | null): string {
        let result: string = '';
        if(value) {
            let parsedValue = Number(value);
            result = parsedValue.toFixed(0);
        }
        return result;
    }

    private static formatDateTime(value: string | null, usage?: string | null): string {
        let result: string = '';
        if(value && value.length) {
            let date = new Date(value);
            let format = 'LLL';
            if(usage) {
                if(usage == 'datetime/short' || usage == 'date/time.short') {
                    // 06/08/23
                    format = (moment.localeData().longDateFormat('L') + ' ' + moment.localeData().longDateFormat('LT')).replace(/YYYY/g,'YY');
                }
                else if(usage == 'datetime/full' || usage == 'date/time.full') {
                    format = 'LLLL';
                }
                else if(usage == 'datetime/plain.medium' || usage == 'date/time.medium') {
                    // 06/08/2023
                    format = 'L';
                }
                else if(usage == 'time' || usage == 'time/plain') {
                    format = 'HH:mm';
                }
            }
            // convert datetime to string, according to locale and usage
            result = moment(date).format(format);
        }
        return result;
    }

    private static formatDate(value: string | null, usage?: string | null): string {
        let result: string = '';
        if(value && value.length) {
            let date = new Date(value);
            // moment 'll': en = "Jul 8, 2023"; fr = "8 juil. 2023"
            let format = 'll';
            // #todo - complete based on retrieved locale from equal (@see packages/core/i18n/.../locale.json)
            if(usage) {
                if(usage == 'date' || usage == 'date/medium' || usage == 'date/plain.medium') {
                    // 06/08/2023
                    format = 'L';
                }
                else if(usage == 'date/short' || usage == 'date/plain.short') {
                    // 06/08/23
                    format = (moment.localeData().longDateFormat('L')).replace(/YYYY/g, 'YY');
                }
                else if(usage == 'date/plain.short.day') {
                    format = 'dd ' + (moment.localeData().longDateFormat('L')).replace(/YYYY/g, 'YY');
                }
                else if(usage == 'month' || usage.indexOf('date/month') == 0) {
                    format = 'MMM YYYY';
                }
            }
            // convert datetime to string, according to locale and usage
            result = moment(date).format(format);
        }
        return result;
    }

    private static formatTime(value: any, usage?: string |null): string {
        let result = value ?? '';
        if(value) {
            if(typeof value === 'number' && Number.isFinite(value)) {
                result = String(Math.floor(value / 3600)).padStart(2, '0') + ':' +
                    String(Math.floor((value % 3600) / 60)).padStart(2, '0') + ':' +
                    String(value % 60).padStart(2, '0');
            }
            else if(value instanceof Date && !isNaN(value.getTime())) {
                // if we received a date, convert it to a string
                result = (<Date> value).toTimeString().substring(0, 5);
            }
        }
        return <string> result;
    }

    private normalizeToPx(v: any): string {
        if(v === 'auto') {
            return v;
        }
        let n = (typeof v === 'number') ? v : parseInt(v as string, 10);
        if(isNaN(n)) {
            n = 0;
        }
        return `${n}px`;
    }

    protected applyStyling($elem: any){

        if(this.config.hasOwnProperty('wrap') && this.config.wrap) {
            this.$elem.addClass('sb-string-wrap');
        }

        if(this.config.hasOwnProperty('text_decoration') && this.config.text_decoration) {
            if(this.config.text_decoration === 'underline') {
                $elem.css({'border-bottom': 'solid 1px black'});
            }
        }

        if(this.config.hasOwnProperty('text_color') && this.config.text_color) {
            $elem.css({'color': this.config.text_color});
        }

        if(this.config.hasOwnProperty('text_weight') && this.config.text_weight) {
            $elem.css({'font-weight': this.config.text_weight});
        }

        if(this.config.hasOwnProperty('text_align') && this.config.text_align) {
            $elem.css({'text-align': this.config.text_align});
        }

        if(this.config.hasOwnProperty('text_width') && this.config.text_width) {
            $elem.css({
                    'width': this.normalizeToPx(this.config.text_width),
                    'min-width': this.normalizeToPx(this.config.text_width)
                });
        }

        if(this.config.hasOwnProperty('background_color') && this.config.background_color) {
            $elem.css({'background-color': this.config.background_color});
        }

        if(this.config.hasOwnProperty('border_radius') && this.config.border_radius) {
            $elem.css({'border-radius': this.normalizeToPx(this.config.border_radius)});
        }

        if(this.config.hasOwnProperty('border_color') && this.config.border_color) {
            $elem.css({'border-color': this.config.border_color});
        }

        if(this.config.hasOwnProperty('padding') && this.config.padding) {
            $elem.css({'padding': this.config.padding});
        }

        if(this.config.hasOwnProperty('margin') && this.config.margin) {
            $elem.css({'margin': this.config.margin});
        }
    }
}