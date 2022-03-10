import Widget from "./Widget";
import Layout from "../Layout";

import { UIHelper } from '../material-lib';

import moment from 'moment/moment.js';
import { $, jqlocale } from "../jquery-lib";

export default class WidgetDateTime extends Widget {
        
    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, 'date', label, value, config);
    }

    public change(value: any) {
        this.$elem.find('input').val(value).trigger('change');
    }

    public render(): JQuery {
        let date = new Date(this.value);
        let value:any;

        switch(this.mode) {
            case 'edit':
                var format = moment.localeData().longDateFormat('L') + ' ' + moment.localeData().longDateFormat('LT');
                value = moment(date).format(format);
                this.$elem = UIHelper.createInput('', this.label, value, this.config.description, 'calendar_today');
                // setup handler for relaying value update to parent layout
                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                }
                this.$elem.find('input')
                .on('keypress', (event:any) => {
                    if (event.which == 9) {
                        // #todo: force focus to the next input
                        event.preventDefault();
                    }
                })
                .on('change', (event) => {
                    let $this = $(event.currentTarget);
                    this.value = $this.val();
                    let mdate = moment(this.value, format, true);
                    if(mdate.isValid()) {
                        date = mdate.toDate();
                        $datetimepicker.datepicker('setDateTime', date);    
                    }
                });

                let $datetimepicker = $('<input type="text" />')
                .addClass('sb-view-layout-form-input-decoy')
                .datepicker( {
                    datetime: true, 
                    twentyFour: true, 
                    showSeconds: false, 
                    ...jqlocale[this.getLayout().getEnv().locale],
                    onClose: () => {
                        let date = $datetimepicker.datepicker('getDate');
                        this.value = date.toISOString();
                        this.$elem.trigger('_updatedWidget');
                        // give the focus back once the widget will have been refreshed
                        setTimeout( () => {
                            $('#'+this.getId()).find('input').first().trigger('focus');
                        }, 250);
                    }
                } )
                .on('change', (event:any) => {
                    // update widget value using jQuery `getDate`
                    let $this = $(event.currentTarget);
                    let new_date = $this.datepicker('getDate');
                    // $elem.trigger('_updatedWidget', date.toISOString());
                    this.$elem.find('input').val(moment(new_date).format(format));
                });
                this.$elem.append($datetimepicker);

                this.$elem.append(
                    $('<div />').addClass('sb-view-layout-form-input-button')
                    .one('click', () => {
                        $datetimepicker.datepicker('setDateTime', date);
                    })
                    .on('click', () => {
                        $datetimepicker.datepicker('show');
                    })
                );

                break;
            case 'view':
            default:
                value = moment(date).format('LLL');
                this.$elem = UIHelper.createInputView('', this.label, value);
                break;
        }
        this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());

        return this.$elem;
    }
    
}