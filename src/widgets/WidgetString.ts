import Widget from "./Widget";
import Popover from "../Popover";
import { View, Layout, EntityHelper } from "../equal-lib";
import { UIHelper } from '../material-lib';

export default class WidgetString extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, label, value, config);
    }

    /**
     * This method is meant to be used for updating the value of the widget from the View or the Layout.
     * It is meant for edit mode, support for view mode is partial.
     */
    public change(value: any) {
        console.log('WidgetString::change', value, this);
        if(typeof value == 'string') {
            value = value.replace(/"/g, "&quot;");
        }
        if(this.mode === 'edit') {
            this.$elem.find('input').val(value).trigger('change');
        }
        else {
            const has_input = this.$elem.find('input').length;
            if(has_input) {
                this.$elem.find('input').val(value);
            }
            else {
                this.$elem.html(value);
            }
        }
        return this;
    }

    public render(): JQuery {
        let value: any = (typeof this.value != undefined && this.value != undefined) ? this.value : '';
        let usage = (this.config.hasOwnProperty('usage')) ? this.config.usage : '';

        const debugPopoversEnabled = this.mode === 'view' && this.getLayout().getView().getEnv()?.debug;
        this.destroyPopovers();

        if(typeof value == 'string') {
            value = value.replace(/"/g, "&quot;");
        }
        switch(this.mode) {
            case 'edit':

                // support for adding selection after onchange
                // #todo - merge with WidgetSelect (we should add selection capabilities to all widget, and remove WidgetSelect)
                if(this.config.hasOwnProperty('selection')) {
                    this.$elem = UIHelper.createSelect('widget-string_' + this.getId(), this.label, this.config.selection, value, this.config.description, this.readonly);
                    this.$elem.trigger('select', value);
                }
                else {
                    this.$elem = UIHelper.createInput('widget-string_' + this.getId(), this.label, value, this.config.description, '', this.readonly);
                }

                if(this.config.layout == 'list') {
                    this.$elem.css({"width": "calc(100% - 10px)"});
                }

                let $input = this.$elem.find('input');

                // #memo - not dealing with keydown is preferred in order to avoid confusion with special keys
                // #memo - use of 'change' event to cover float and integers changes with up and down buttons (same timeout)
                $input.on('change', (event:any) => {
                    console.log('WidgetString::$input:change', event);
                    let $this = $(event.currentTarget);

                    if(this.value != $this.val()) {
                        // value changed, relaying _updatedWidget
                        this.value = $this.val();
                        this.$elem.trigger('_updatedWidget', [false]);
                    }
                });

                // #todo - handle config.onfocus : 'none', 'select', 'reset'
                $input.on('focus', function() {
                    $input.trigger('select');
                });

                break;
            case 'view':
            default:
                let $link;

                if(this.config.layout == 'list') {
                    if(usage.indexOf('phone') >= 0) {
                        $link = $('<a target="_blank" href="tel:' + value + '">' + value + '</a>');
                        $link.on('click', (event) => {
                            event.stopPropagation();
                        });
                    }
                    else if(usage.indexOf('email') >= 0) {
                        $link = $('<a target="_blank" href="mailto:' + value + '">' + value + '</a>');
                        $link.on('click', (event) => {
                            event.stopPropagation();
                        });
                    }
                }

                if($link) {
                    this.$elem = $('<div />');
                    this.$elem.append($link);
                }
                else {
                    if(this.config.layout == 'list') {
                        // #todo - improve this support
                        if(usage.indexOf('icon') >= 0 || usage.indexOf('symbol') >= 0) {
                            // map eQual standard icons with material icons
                            let map_icons:any = {
                                    success:   {icon: "check_circle", color: "#27b727" /*green*/},
                                    info:      {icon: "info", color: "blue"},
                                    warn:      {icon: "warning", color: "orange"},
                                    major:     {icon: "error", color: "orangered"},
                                    important: {icon: "error", color: "orangered"},
                                    error:     {icon: "report", color: "red"},
                                    paid:      {icon: "paid", color: "green"},
                                    due:       {icon: "money_off", color: "red"},
                                    valid:     {icon: "check_circle", color: "green"},
                                    invalid:   {icon: "error", color: "red"},
                                    for:       {icon: "thumb_up", color: "green"},
                                    against:   {icon: "thumb_down", color: "red"},
                                    abstain:   {icon: "remove", color: "grey"},
                                    folder:    {icon: "folder", color: "#F8D775"},
                                    file:      {icon: "description", color: "grey"},
                                    document:  {icon: "description", color: "grey"},
                                    full:      {icon: "circle", color: "green"},
                                    part:      {icon: "adjust", color: "orange"},
                                    none:      {icon: "radio_button_unchecked", color: "red"}
                                };

                            this.$elem = $('<div />').attr('id', 'widget-string_' + this.getId());

                            if(map_icons.hasOwnProperty(value)) {
                                this.$elem.append( $('<span class="material-icons">' + map_icons[value].icon + '</span>').css({color: map_icons[value].color}) );
                            }
                            else {
                                this.$elem.append( $('<span class="material-icons">' + value + '</span>') );
                            }
                            this.$elem.css({"width": "100%", "text-align": "center"});
                        }
                        else {
                            this.$elem = $('<div />')
                                .html(value)
                                .addClass('sb-string-flow');
                        }
                    }
                    else {
                        this.$elem = UIHelper.createInputView('widget-string_' + this.getId(), this.label, value, this.config.description);
                    }

                    // decorate the widget according to styles present in config
                    this.applyStyling(this.$elem);

                    if(debugPopoversEnabled) {
                        this.createPopovers();
                    }
                    else {
                        this.$elem.attr('title', value);
                    }
                }
                break;
        }

        if(this.config.hasOwnProperty('heading') && this.config.layout == 'form') {
            this.$elem.addClass('title');
        }

        return this.$elem
            .addClass('sb-widget')
            .addClass('sb-widget-type-string')
            .addClass('sb-widget-mode-' + this.mode)
            .attr('id', this.getId())
            .attr('data-type', this.config.type)
            .attr('data-field', this.config.field)
            .attr('data-usage', this.config.usage || '');
    }

    private createPopovers() {
        const env = this.getLayout().getView().getEnv();
        if(this.mode !== 'view' || !env?.debug) {
            return;
        }

        const $label = this.$elem.find('.sb-ui-text-field-label').first();
        const $input = this.$elem.find('.sb-ui-text-field-input').first();
        const $description = this.$elem.find('.sb-ui-text-field-helper').first();

        // remove title attributes, if any - to prevent hover conflict with popovers
        this.$elem.removeAttr('title');
        $input.removeAttr('title');
        $description.removeAttr('title');
        $label.removeAttr('title');

        const entity = this.getLayout().getEntity();
        const field = this.config.field ?? '';

        if($label.length) {
            const url = '/workbench/#/package/' + EntityHelper.getPackageName(entity) + '/model/' + EntityHelper.getClassName(entity) + '/translations?tab=model&field=' + field + '-label'
            new Popover($label, {
                title: 'Label translation',
                body: $('<div />')
                    .append($('<div />').html('Field: <b>' + field + '</b>'))
                    .append($('<div />').html('Label: <b>' + this.label + '</b>')),
                externalLink: url,
                clipboardValue: this.label,
                group: this.getPopoverGroup(),
                openDelay: 800,
                closeDelay: 300
            });
        }

        if($input.length) {
            const url = '/workbench/#/package/' + EntityHelper.getPackageName(entity) + '/model/' + EntityHelper.getClassName(entity) + '/fields?field=' + field
            new Popover($input, {
                title: 'Field info',
                body: $('<div />')
                    .append($('<div />').html('Field: <b>' + field + '</b>'))
                    .append($('<div />').html('Type: <b>' + (this.config.type ?? '') + '</b>'))
                    .append($('<div />').html('Usage: <b>' + (this.config.usage ?? '') + '</b>')),
                externalLink: url,
                clipboardValue: this.value,
                group: this.getPopoverGroup(),
                openDelay: 800,
                closeDelay: 300
            });
        }

        if($description.length && String(this.config.description ?? '').trim().length) {
            const url = '/workbench/#/package/' + EntityHelper.getPackageName(entity) + '/model/' + EntityHelper.getClassName(entity) + '/translations?tab=model&field=' + field + '-description'
            new Popover($description, {
                title: 'Description translation',
                body: $('<div />')
                    .append($('<div />').html('Field: <b>' + field + '</b>')),
                externalLink: url,
                clipboardValue: this.config.description,
                group: this.getPopoverGroup(),
                openDelay: 800,
                closeDelay: 300
            });
        }
    }

}
