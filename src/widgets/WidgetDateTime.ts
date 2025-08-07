import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

import moment from 'moment/moment.js';
import { $, jqlocale } from "../jquery-lib";

export default class WidgetDateTime extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, label, value, config);
    }

    private jqueryToMomentFormat(format: string): string {
        let result: string = format;
        const formatAdapter : any = {
            'dd': 'DD',
            'mm': 'MM',
            'yy': 'YYYY',
            'hh': 'HH',
            'ii': 'mm'
        };
        for(const key in formatAdapter) {
            let re = new RegExp(key, 'g');
            result = result.replace(re, formatAdapter[key]);
        }
        return result;
    }

    /**
     * Converts a date object to a string according to provided format.
     * Uses moment.js for the formatting.
     *
     * @param date
     * @param format
     */
    private dateToString(date: Date, moment_format: string): string {
        return moment(date).format(moment_format);
    }

    private stringToDate(date_str: string, moment_format: string): Date | null {
        let mdate = moment(date_str, moment_format, true);
        if(mdate.isValid()) {
            return mdate.toDate();
        }
        return null;
    }
    private isValidIsoStringDate(date_str: string): boolean {
        return moment(date_str, moment.ISO_8601, true).isValid();
    }

    private isValidStringDate(date_str: string, moment_format: string): boolean {
        let mdate = moment(date_str, moment_format, true);
        return mdate.isValid();
    }

    private formatIsoStringDate(date_str: string, moment_format: string): string {
        return moment(date_str).format(moment_format);
    }

    public change(value: string | null) {
        // #memo - this is used by inline edit for list views : we cannot trigger a change since it would result in infinite loop (triggering _updatedWidget)
        console.debug('WidgetDateTime::change', value);
        let $datepicker = this.$elem.find('.datepicker');
        let $input = this.$elem.find('input').first();
        if($datepicker.length > 0) {
            if(!this.isValidIsoStringDate(value || '')) {
                $input.val('');
            }
            else {
                let moment_format = this.jqueryToMomentFormat($datepicker.datepicker('option', 'dateFormat') + ' ' + $datepicker.datepicker('option', 'timeFormat'));
                let date = new Date(<string> value);
                $datepicker.datepicker('setDate', date);
                $input.val(this.dateToString(date, moment_format));
            }
        }
    }
    public render(): JQuery {
        console.debug('WidgetDateTime::render', this);
        const locale = this.getLayout().getEnv().locale;
        // #memo - this.value is expected to be either null or a valid ISO date string at all times
        let value_str: string = '';
        // set default moment format to en: mm/dd/yy hh:ii ; fr: dd/mm/yy hh:ii
        let moment_format: string = this.jqueryToMomentFormat(jqlocale[locale].dateFormat + ' ' + jqlocale[locale].timeFormat);

        switch(this.mode) {
            case 'edit':
                let $datetimepicker = $('<input type="text" />').addClass('datepicker sb-widget-datetime-datepicker');

                let datepickerConfig = {
                        datetime: true,
                        twentyFour: true,
                        showSeconds: false,
                        autoOpen: false,
                        ...jqlocale[locale],
                        onClose: () => {
                            // disable events on closing datepicker popup
                            // this will result in datepicker setDate, this.value assignment and trigger _updatedWidget
                            this.$elem.find('input').first().trigger('change');
                        },
                        onSelect: (date_str: string) => {
                            console.log('WidgetDateTime::datepicker:onSelect', date_str);
                            if(this.isValidStringDate(date_str, this.jqueryToMomentFormat(datepickerConfig.dateFormat))) {
                                console.debug('WidgetDateTime::datepicker:onSelect valid date received', date_str);
                                // assign input but do not relay change event (done only in `onClose`)
                                this.$elem.find('input').first().val(date_str).trigger('input');
                            }
                            else {
                                console.debug('WidgetDateTime::datepicker:onSelect invalid date received, fallback to current', date_str);
                            }
                        }
                    };

                // convert jquery format to moment format
                moment_format = this.jqueryToMomentFormat(datepickerConfig.dateFormat + ' ' + datepickerConfig.timeFormat);
                console.debug('WidgetDateTime::init retrieved moment format', moment_format);

                if(this.isValidIsoStringDate(this.value || '')) {
                    console.debug('WidgetDateTime::init valid value', this.value);
                    value_str = this.formatIsoStringDate(this.value, moment_format);
                    datepickerConfig.defaultDate = new Date(this.value);
                }
                else {
                    console.debug('WidgetDateTime::init invalid value', this.value);
                }

                this.$elem = UIHelper.createInput('date_' + this.id, this.label, value_str, this.config.description, '', this.readonly);

                let $input = this.$elem.find('input').first()
                    .on('keypress', (event:any) => {
                        if (event.which == 9) {
                            event.stopImmediatePropagation();
                        }
                    })
                    .on('change', (event) => {
                        let $this = $(event.currentTarget);
                        let date_str: string = <string> $this.val();
                        let moment_format = this.jqueryToMomentFormat(datepickerConfig.dateFormat);
                        console.debug('WidgetDateTime::input:change', event, date_str);

                        if(this.isValidStringDate(date_str, moment_format)) {
                            console.debug('WidgetDateTime::input:change valid date received', date_str);
                            let date: Date = <Date> this.stringToDate(date_str, moment_format);
                            this.value = date.toISOString();
                            if($datetimepicker.data('datepicker')) {
                                $datetimepicker.datepicker('setDateTime', date);
                            }
                            this.$elem.trigger('_updatedWidget');
                        }
                        else {
                            // handle field reset
                            if(date_str === '') {
                                this.value = null;
                                this.$elem.trigger('_updatedWidget');
                            }
                            else {
                                console.debug('WidgetDate::input:change invalid date received, ignoring', date_str);
                            }
                        }
                    });

                let $button_open = UIHelper.createButton('datetime-actions-open_' + this.id, '', 'icon', 'calendar_today')
                    .css({"position": "absolute", "right": "5px", "top": "7px", "z-index": "1"})
                    .on('focus click', () => {
                        let $input = this.$elem.find('input').first();
                        let val: string = <string> $input.val();
                        let moment_format = this.jqueryToMomentFormat(datepickerConfig.dateFormat);
                        // upon opening of the date picker, if input is empty, assign current date
                        if(!val.length) {
                            let date = new Date();
                            // #memo - do not trigger change here, since it would result in layout refresh and loss of datepicker instance data
                            $input.val(this.dateToString(date, moment_format));
                            // force MDC refresh (text.layout())
                            $input.trigger('input');
                        }
                        $datetimepicker.datepicker('show');
                    });

                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                    $button_open.css({"top": "2px"});
                }

                $button_open.insertAfter($input);

                $datetimepicker.datepicker(datepickerConfig)
                    .on('keydown', (event: any) => {
                        // prevent relaying key events to datepicker
                        event.stopImmediatePropagation();
                    })
                    .on('change', (event:any) => {
                        // prevent relaying change event on datepicker input (we use either datepicker:onSelect or input:change)
                        event.stopImmediatePropagation();
                    });

                // #memo - initial setDate is mandatory for further interactions with datepicker popup
                if(this.isValidIsoStringDate(this.value || '')) {
                    $datetimepicker.datepicker('setDateTime', new Date(this.value));
                }
                else {
                    $datetimepicker.datepicker('setDateTime', new Date());
                }

                this.$elem.append($datetimepicker);

                break;
            case 'view':
            default:
                // convert date to string, according to locale and usage
                if(this.isValidIsoStringDate(this.value || '')) {
                    value_str = this.formatIsoStringDate(this.value, moment_format);
                }

                // by convention, first column of each row opens the object no matter the type of the field
                if(this.is_first) {
                    this.$elem = $('<div />').addClass('is-first').text(value_str);
                }
                else {
                    this.$elem = UIHelper.createInputView('datetime_' + this.id, this.label, value_str, this.config.description);
                }
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

}