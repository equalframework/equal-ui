import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

import Quill from "quill";

export default class WidgetText extends Widget {


    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, 'text', label, value, config);
    }

    public change(value: any) {
        // this.$elem.find('textarea').val(value).trigger('change');
        if(this.$elem.data('quill')) {
            let editor = this.$elem.data('quill');
            editor.root.innerHTML = value;
        }
    }

    public render():JQuery {
        let value:string = this.value?this.value:'';
        switch(this.mode) {
            case 'edit':
                if(this.config.layout == 'list') {
                    this.$elem = UIHelper.createInput('', this.label, value, this.config.description, '', this.readonly);
                    this.$elem.css({"width": "calc(100% - 10px)"});
                    // setup handler for relaying value update to parent layout
                    this.$elem.find('input').on('change', (event) => {
                        let $this = $(event.currentTarget);
                        this.value = $this.val();
                        if(this.value != value) {
                            this.$elem.trigger('_updatedWidget', [false]);
                        }
                    });

                }
                else {
                    this.$elem = $('<div class="sb-ui-textarea" />');

                    let $editor = $('<div quill__editor></div>');

                    this.$elem.append($editor);

                    this.getLayout().getView().isReady().then( () => {
                        // init inline styling
                        var ColorClass = Quill.import('attributors/class/color');
                        var SizeStyle = Quill.import('attributors/style/size');
                        var AlignStyle = Quill.import('attributors/style/align');
                        Quill.register(ColorClass, true);
                        Quill.register(SizeStyle, true);
                        Quill.register(AlignStyle,true);

                        const editor = new Quill($editor[0], {
                            placeholder: this.config.description,
                            theme: "snow",
                            modules: {
                                toolbar: [
                                    ['bold', 'italic', 'underline', 'strike'],
                                    ['blockquote'],
                                    // [{ 'header': [1, 2, 3, 4, 5, 6, false]}],
                                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                    [{ "align": '' }, { "align": 'center' }, { 'align': 'right' }],
                                    [{ 'size': ['small', false, 'large', 'huge'] }],
                                    ['fullscreen']  
                                ]
                            }
                        });

                        this.$elem.find('.ql-fullscreen').on('click', () => {
                            let elem: any = this.$elem[0];
                            if (elem.requestFullscreen) {
                                elem.requestFullscreen();
                            } else if (elem.hasOwnProperty('webkitRequestFullscreen')) {
                                elem['webkitRequestFullscreen']();
                            }
                        });                    

                        this.$elem.data('quill', editor);

                        editor.root.innerHTML = value;

                        let timeout: any;

                        editor.on('text-change', (delta, source) => {
                            this.value = editor.root.innerHTML;
                            // update value without refreshing the layout
                            if(this.value != value) {
                                // debounce updates
                                if(timeout) {
                                    clearTimeout(timeout);
                                }
                                timeout = setTimeout( () => {
                                    this.$elem.trigger('_updatedWidget', [false]);
                                }, 1000);                            
                            }                        
                        })

                    })                    
                }
                break;
            case 'view':
            default:
                if(this.config.layout == 'list') {
                    value = $("<div/>").html(value).text();
                    this.$elem = UIHelper.createInputView('', this.label, value, this.config.description);
                }
                else {
                    this.$elem = $('<div class="sb-ui-textarea" />').append( $('<div class="textarea-content" />').html(value) );                
                }
                
                break;
        }

        if(this.config.layout != 'list') {
            this.$elem.append( $('<div class="textarea-title" />').text(this.label) );
        }

        this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());
        return this.$elem;

    }

}