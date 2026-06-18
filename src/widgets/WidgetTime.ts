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
        let value: any = this.adaptIn(this.value ?? '');

        switch(this.mode) {
            case 'edit':
                this.$elem = UIHelper.createInput('time_' + this.id, this.label, value, this.config.description, '', this.readonly);
                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                }

                // #memo - not dealing with keydown is preferred to avoid confusion about special keys role
                // #memo - we use 'change' event to cover float and integers changes with up and down buttons (same timeout)
                this.$elem.find('input').on('change', (event: any) => {
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

        this.applyHeading();

        return this.$elem
            .addClass('sb-widget')
            .addClass('sb-widget-mode-' + this.mode)
            .attr('id', this.getId())
            .attr('data-type', this.config.type)
            .attr('data-field', this.config.field)
            .attr('data-usage', this.config.usage || '');
    }

    /**
     * Adapt backend time (HH:mm[:ss]) to view time (HH:mm).
     */
    private adaptIn(value: any): string {
        if(!value) {
            return '';
        }

        if(Object.prototype.toString.call(value) === '[object Date]') {
            const date = value as Date;
            const h = date.getHours().toString().padStart(2, '0');
            const m = date.getMinutes().toString().padStart(2, '0');
            return `${h}:${m}`;
        }

        if(typeof value !== 'string') {
            return '';
        }

        const parts = this.normalizeTimeString(value).split(':');
        const h = this.parseTimePart(parts[0]);
        const m = this.parseTimePart(parts[1]);

        return `${this.formatTimePart(h)}:${this.formatTimePart(m)}`;
    }

    /**
     * Adapt view time (HH:mm) to backend time (HH:mm:ss).
     */
    private adaptOut(): string {
        const input = this.$elem?.find('input').val();
        if(!input) {
            return '';
        }

        const parts = this.normalizeTimeString(String(input)).split(':');
        const h = this.parseTimePart(parts[0]);
        const m = this.parseTimePart(parts[1]);
        const s = this.parseTimePart(parts[2]);

        return `${this.formatTimePart(h)}:${this.formatTimePart(m)}:${this.formatTimePart(s)}`;
    }

    private normalizeTimeString(value: string): string {
        return value
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/^(\d{1,2})h(\d{0,2})$/, (match: string, h: string, m: string) => {
                    const hh = h.padStart(2, '0');
                    const mm = m.padStart(2, '0');
                    return `${hh}:${mm}`;
                }
            );
    }

    private parseTimePart(value: any): number {
        const parsed = parseInt(value ?? '0', 10);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    private formatTimePart(value: number): string {
        return value.toString().padStart(2, '0');
    }

}
