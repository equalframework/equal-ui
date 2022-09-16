import Widget from "./Widget";
import { UIHelper } from '../material-lib';
import { ApiService, TranslationService } from "../equal-services";

import { View, Layout } from "../equal-lib";
import Domain from "../Domain";

export default class WidgetMany2One extends Widget {


    constructor(layout: Layout, label: string, value: any, config: any) {
        super(layout, 'many2one', label, value, config);
    }

    public render():JQuery {
        // in edit mode, we should have received an id, and in view mode, a name
        let value:string = this.value?this.value:'';
        let domain:any = [];
        if(this.config.hasOwnProperty('domain')) {
            domain = this.config.domain;
        }

        // #todo : display many2one as sub-forms

        // on right side of widget, add an icon to open the target object (current selection) into a new context
        let $button_open = UIHelper.createButton('m2o-actions-open-'+this.id, '', 'icon', 'open_in_new').attr('tabindex', -1);
        let $button_create = UIHelper.createButton('m2o-actions-create-'+this.id, '', 'icon', 'add').attr('tabindex', -1);

        switch(this.mode) {

            case 'edit':
                let objects:Array<any> = [];
                this.$elem = $('<div />');

                let $select = UIHelper.createInput('m2o-input-'+this.id, this.label, value, this.config.description, '', this.readonly)
                                      .addClass('mdc-menu-surface--anchor')
                                      .css({"width": "100%", "display": "inline-block"});
                let $menu = UIHelper.createMenu('m2o-menu-'+this.id).appendTo($select);
                let $menu_list = UIHelper.createList('m2o-menu-list-'+this.id).appendTo($menu);
                let $link = UIHelper.createListItem('m2o-actions-create-'+this.id, '<a style="text-decoration: underline;">'+TranslationService.instant('SB_WIDGETS_MANY2ONE_ADVANCED_SEARCH')+'</a>');

                if(this.config.has_action_open || this.config.has_action_create) {
                    $select.css({"width": "calc(100% - 48px)"});
                }

                UIHelper.decorateMenu($menu);

                if(value.length) {
                    $button_create.hide();
                }
                else {
                    $button_open.hide();
                }

                this.$elem.append($select);

                if(this.config.hasOwnProperty('object_id') && this.config.object_id > 0) {
                    $select.attr('data-selected', this.config.object_id);
                }

                if(!this.config.has_action_open) {
                    $button_open.hide();
                }
                else {
                    this.$elem.append($button_open);
                    // open targeted object in new context
                    $button_open.on('click', async () => {
                        if(this.config.hasOwnProperty('object_id')) {
                            this.getLayout().openContext({
                                entity: this.config.foreign_object,
                                type: 'form',
                                mode: 'edit',
                                name: (this.config.hasOwnProperty('view_name'))?this.config.view_name:'default',
                                domain: ['id', '=', this.config.object_id],
                                callback: (data:any) => {
                                    if(data && data.selection && data.objects && data.selection.length) {
                                        // we should have received a single (partial) object with up-to-date name and id
                                        let object = data.objects.find( (o:any) => o.id == data.selection[0] );
                                        this.value = {id: object.id, name: object.name};
                                        this.$elem.trigger('_updatedWidget');
                                    }
                                }
                            });
                        }
                    });
                }

                if(!this.config.has_action_create) {
                    $button_create.hide();
                }
                else {
                    this.$elem.append($button_create);
                    // open creation form in new context
                    $button_create.on('click', async () => {
                        this.getLayout().openContext({
                            entity: this.config.foreign_object,
                            type: 'form',
                            mode: 'edit',
                            purpose: 'create',
                            domain: domain,
                            name: (this.config.hasOwnProperty('view_name'))?this.config.view_name:'default',
                            callback: (data:any) => {
                                if(data && data.selection && data.objects && data.selection.length) {
                                    $button_create.hide();
                                    $button_open.show();
                                    // m2o relations are always loaded as an object with {id:, name:}
                                    let object = data.objects.find( (o:any) => o.id == data.selection[0] );
                                    this.value = {id: object.id, name: object.name};
                                    this.$elem.trigger('_updatedWidget');
                                }
                            }
                        });
                    });
                }


                let openSelectContext = () => {
                    this.getLayout().openContext({...this.config,
                        entity: this.config.foreign_object,
                        /*
                        type: (this.config.hasOwnProperty('view_type'))?this.config.view_type:'list',
                        name: (this.config.hasOwnProperty('view_name'))?this.config.view_name:'default',
                        */
                        type: 'list',
                        name: 'default',
                        domain: domain,
                        mode: 'view',
                        purpose: 'select',
                        limit: 25,
                        callback: (data:any) => {
                            if(data && data.selection && data.objects && data.selection.length) {
                                // m2o relations are always loaded as an object with {id:, name:}
                                let object = data.objects.find( (o:any) => o.id == data.selection[0] );
                                this.value = {id: object.id, name: object.name};
                                this.$elem.trigger('_updatedWidget');
                            }
                        }
                    });
                };

                let query = '';

                let feedObjects = async () => {
                    let $input = $select.find('input');
                    if(!$input.length) return;
                    let val = <string> $input.val();
                    let parts:string[] = val.split(" ");

                    if(val != query || !objects.length) {
                        query = val;

                        let domainArray = [];
                        for(let word of parts) {
                            let cond = ['name', 'ilike', '%'+word+'%'];
                            domainArray.push(cond);
                        }
                        let tmpDomain = new Domain(domainArray);
                        tmpDomain.merge(new Domain(domain));
                        // fetch first objects from config.foreign_object (use config.domain) + add an extra line ("advanced search...")
                        let limit = (this.config.limit)?this.config.limit:5;

                        try {
                            let response = await ApiService.collect(this.config.foreign_object, tmpDomain.toArray(), ['id', 'name'], 'id', 'asc', 0, limit, this.config.lang);
                            objects = response;
                            $menu_list.empty();
                            for(let object of objects) {
                                UIHelper.createListItem(this.id+'-object-'+object.id, object.name.replaceAll(' ', '&nbsp;'))
                                .appendTo($menu_list)
                                .attr('id', object.id)
                                .on('click', (event) => {
                                    $input.val(object.name).trigger('change');
                                    $select.attr('data-selected', object.id);
                                    $select.trigger('update');
                                })
                            }
                            if(objects.length) {
                                if(objects.length == 1) {
                                    // if list is exactly 1 object long : auto-select
                                    let object = objects[0];
                                    $input.val(object.name).trigger('change');
                                    $select.attr('data-selected', object.id);
                                    $select.trigger('update');
                                }
                                else {
                                    $menu_list.append(UIHelper.createListDivider());
                                }
                            }
                            // advanced search button
                            $link.on('click', openSelectContext);
                            $menu_list.append($link);

                        }
                        catch(response) {
                            console.warn('request failed', response);
                        }
                    }

                    // make the menu sync with its parent width (menu is 'fixed')
                    $select.find('.mdc-menu-surface').width(<number>$select.width());
                };

                if(this.config.layout == 'form' && !this.readonly) {

                    let $button_reset = UIHelper.createButton('m2o-actions-reset-'+this.id, '', 'icon', 'close').css({"position": "absolute", "right": "45px", "top": "5px", "z-index": "2"});

                    if(!this.config.has_action_open && !this.config.has_action_create) {
                        $button_reset.css({"right": "5px"});
                    }

                    if(value.length) {
                        this.$elem.append($button_reset);
                        // make room for reset button
                        $select.find('input').css({'width': 'calc(100% - 50px)'});
                    }

                    let has_focus:boolean = false;
                    let dblclick_timeout:boolean = false;

                    $button_reset.on('click', (event:any) => {
                        this.value = {id: 0, name:''};
                        $select.attr('data-selected', 0);
                        this.$elem.trigger('_updatedWidget');
                        // if keyboard, give back the focus to the input after refreshing the view (other object, same ID)
                        if (event.screenX == 0 && event.screenY == 0) {
                            setTimeout( () => {
                                $('#m2o-input-'+this.id).find('input').trigger('focus');
                                $('#m2o-input-'+this.id).trigger('click');
                            }, 500);
                        }
                    });

                    $select.find('input').on('blur', (event:any) => {
                        event.stopPropagation();
                        if(dblclick_timeout) {
                            return;
                        }
                        if(!has_focus) {
                            return;
                        }
                        // wait for the focus be given at next widget AND change to be relayed, if any
                        setTimeout( () => {
                            has_focus = false;
                            $menu.trigger('_close');
                        }, 150);
                    });

                    $select.on('click', (event:any) => {
                        event.stopPropagation();
                        if(dblclick_timeout) {
                            return;
                        }
                        // click on a focused input blurs (workaround for disapearing menu)
                        if(has_focus) {
                            has_focus = false;
                            dblclick_timeout = true;
                            $select.find('input').blur();
                            setTimeout( () => {
                                dblclick_timeout = false;
                                // $menu.trigger('_close');
                            }, 500);
                        }
                        else {
                            if(!value.length) {
                                $menu.trigger('_open');
                            }
                        }
                    });

                    $select.find('input').on('focus', (event:any) => {
                        event.stopPropagation();

                        if($select.attr('data-selected')) {
                            return;
                        }
                        if(dblclick_timeout) {
                            $select.find('input').blur();
                            return;
                        }
                        if(has_focus) {
                            return;
                        }
                        has_focus = false;
                        feedObjects();
                        // delay has_focus to distinguish first focus and later
                        setTimeout( () => {
                            has_focus = true;
                        }, 250);

                    });

                    let timeout:any = null;

                    $select.find('input')
                    .on('keyup', (event:any) => {
                        if(event.which == 9) {
                            // if clicked ok, if tab only not
                            $select.trigger('click');
                            // prevent double handling tab
                            return;
                        }
                        else if(event.which == 13) {
                            // enter
                            $menu.trigger('_select');
                        }
                        else if(event.which == 38) {
                            // up arrow
                            $menu.trigger('_moveup');
                        }
                        else if(event.which == 40) {
                            // down arrow
                            $menu.trigger('_movedown');
                        }
                        else {
                            // new char : update results
                            if(timeout) {
                                clearTimeout(timeout);
                            }
                            timeout = setTimeout(() => {
                                timeout = null;
                                feedObjects();
                            }, 300);
                        }
                    });

                    // upon value change, relay updated value to parent layout
                    $select.on('update', (event) => {
                        console.debug('WidgetMany2One : received change event', $select.attr('data-selected'));
                        // m2o relations are always loaded as an object with {id:, name:}
                        let object:any = objects.find( o => o.id == $select.attr('data-selected'));
                        if(object) {
                            if(this.config.has_action_open) {
                                $button_open.show();
                            }
                            $button_create.hide();
                            this.value = {id: object.id, name: object.name};
                            this.$elem.trigger('_updatedWidget');
                        }
                        else {
                            if(this.config.has_action_create) {
                                $button_create.show();
                            }
                            $button_open.hide();
                        }
                    });
                }

                // #memo - we condition load on init to fields with empty values AND having a domain set
                // (to prevent burst requests when view is displayed in edit mode)
                if( (!value || !value.length) && domain.length) {
                    setTimeout( () => feedObjects(), 250);
                }

                break;
            case 'view':
            default:
                this.$elem = $('<div />');
                let $input = UIHelper.createInputView('', this.label, value.toString(), this.config.description);

                switch(this.config.layout) {
                    case 'form':
                        $input.css({"width": "calc(100% - 48px)", "display": "inline-block"});

                        this.$elem.append($input);

                        if(this.config.has_action_open) {
                            this.$elem.append($button_open);
                            // open targeted object in new context
                            $button_open.on('click', async () => {
                                if(this.config.hasOwnProperty('object_id') && this.config.object_id && this.config.object_id > 0) {
                                    this.getLayout().openContext({
                                        entity: this.config.foreign_object,
                                        type: 'form',
                                        name: (this.config.hasOwnProperty('view_name'))?this.config.view_name:'default',
                                        domain: ['id', '=', this.config.object_id]
                                    });
                                }
                            });
                        }
                        break;
                    case 'list':
                    default:
                        // by convention, first column of each row opens the object no matter the type of the field
                        if(this.is_first) {
                            this.$elem.addClass('is-first');
                        }

                        this.$elem.text(value.toString());
                        this.$elem.css({"width": "100%", "height": "auto", "max-height": "calc(44px - 2px)", "white-space": "break-spaces", "overflow": "hidden", "cusor": "pointer"});

                        if(!this.is_first) {
                            // open targeted object in new context
                            this.$elem.on('click', async (event: any) => {
                                this.getLayout().openContext({
                                    entity: this.config.foreign_object,
                                    type: 'form',
                                    name: (this.config.hasOwnProperty('view_name'))?this.config.view_name:'default',
                                    domain: ['id', '=', this.config.object_id]
                                });
                                event.stopPropagation();
                            });
                        }
                }
                break;
        }


        this.$elem.addClass('sb-widget').addClass('sb-widget-type-many2one').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());

        return this.$elem;
    }
}