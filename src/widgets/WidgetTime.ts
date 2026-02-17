import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

export default class WidgetTime extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, label, value, config);
    }

    public change(value: any) {
        this.$elem.find('input').val(this.adaptIn(value)).trigger('change');
        return this;
    }

    public render(): JQuery {
        // adaptIN - times are always UTC - (browser time offset is applied)
        let value: any = this.adaptIn(this.value ?? '');

        switch(this.mode) {
            case 'edit':
                this.$elem = UIHelper.createInput('time_'+this.id, this.label, value, this.config.description, '', this.readonly);
                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                }

                // #memo - not dealing with keydown is preferred to avoid confusion about special keys role
                // #memo - we use 'change' event to cover float and integers changes with up and down buttons (same timeout)
                this.$elem.find('input').on('change', (event: any) => {
                    // adapt-OUT - times are always be UTC
                    const newValue = this.adaptOut();
                    if(this.value !== newValue) {
                        this.value = newValue;
                        this.$elem.trigger('_updatedWidget', [false]);
                    }
                });

                break;
            case 'view':
            default:
                if(this.config.layout == 'list') {
                    this.$elem = $('<div />').html(value);
                    // time fields are aligned right
                    this.$elem.css({
                        'width': '100%',
                        'text-align': 'right',
                        'height': 'auto',
                        'max-height': 'calc(44px - 2px)',
                        'white-space': 'break-spaces',
                        'overflow': 'hidden'});
                }
                else {
                    this.$elem = UIHelper.createInputView('time_' + this.id, this.label, value, this.config.description);
                }
                this.$elem.attr('title', value);
                break;
        }

        if(this.config.hasOwnProperty('heading') && this.config.layout == 'form') {
            this.$elem.addClass('title');
        }

        return this.$elem
            .addClass('sb-widget')
            .addClass('sb-widget-mode-' + this.mode)
            .attr('id', this.getId())
            .attr('data-type', this.config.type)
            .attr('data-field', this.config.field)
            .attr('data-usage', this.config.usage || '');
    }

    /**
     * Adapt UTC time (HH:mm[:ss]) to local time (HH:mm)
     */
    private adaptIn(value: any): string {
        if(!value) {
            return '';
        }

        // normalize human time formats like "10h30", "10 h", "10 h 30"
        // #memo - this format should never be provided here
        value = value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/^(\d{1,2})h(\d{0,2})$/, (match: string, h: string, m: string) => {
                    const hh = h.padStart(2, '0');
                    const mm = m.padStart(2, '0');
                    return `${hh}:${mm}`;
                }
            );

        // Date object assumed UTC
        if(Object.prototype.toString.call(value) === '[object Date]') {
            const h = value.getUTCHours().toString().padStart(2, '0');
            const m = value.getUTCMinutes().toString().padStart(2, '0');
            return `${h}:${m}`;
        }

        if(typeof value !== 'string') {
            return '';
        }

        const parts = value.split(':').map(Number);
        const h = parts[0] ?? 0;
        const m = parts[1] ?? 0;
        const s = parts[2] ?? 0;

        const now = new Date();
        const utcDate = new Date(Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            h, m, s
        ));

        const lh = utcDate.getHours().toString().padStart(2, '0');
        const lm = utcDate.getMinutes().toString().padStart(2, '0');

        return `${lh}:${lm}`;
    }

    /**
     * Adapt local time (HH:mm) to UTC time (HH:mm:ss)
     */
    private adaptOut(): string {
        const input = this.$elem?.find('input').val();
        if(!input) {
            return '';
        }

        let value = String(input);

        value = value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/^(\d{1,2})h(\d{0,2})$/, (match: string, h: string, m: string) => {
                    const hh = h.padStart(2, '0');
                    const mm = m.padStart(2, '0');
                    return `${hh}:${mm}`;
                }
            );

        const parts = value.split(':').map(Number);
        const h = parts[0] ?? 0;
        const m = parts[1] ?? 0;
        const s = parts[2] ?? 0;

        const localDate = new Date();
        localDate.setHours(h, m, s, 0);

        const uh = localDate.getUTCHours().toString().padStart(2, '0');
        const um = localDate.getUTCMinutes().toString().padStart(2, '0');
        const us = localDate.getUTCSeconds().toString().padStart(2, '0');

        return `${uh}:${um}:${us}`;
    }

}