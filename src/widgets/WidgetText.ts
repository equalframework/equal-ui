import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

import { UIHelper } from '../material-lib';

import Quill from "quill";

export default class WidgetText extends Widget {


    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, label, value, config);
    }

    public change(value: any) {
        // this.$elem.find('textarea').val(value).trigger('change');
        if(this.$elem.data('quill')) {
            let editor = this.$elem.data('quill');
            editor.root.innerHTML = this.adaptIn(value);
        }
    }

    private updateWidget() {
        this.value = this.adaptOut();
        this.$elem.trigger('_updatedWidget', [false]);
    }

    public render():JQuery {
        let value: string = this.value ? this.value : '';
        let mode = this.mode;

        if(this.readonly && this.config.layout == 'form') {
            mode = 'view';
        }

        switch(mode) {
            case 'edit':
                if(this.config.layout == 'list') {
                    this.$elem = UIHelper.createInput('text_' + this.id, this.label, value, this.config.description, '', this.readonly);
                    this.$elem.css({"width": "calc(100% - 10px)"});
                    // setup handler for relaying value update to parent layout
                    this.$elem.find('input').on('change', (event) => {
                        let $this = $(event.currentTarget);
                        this.value = $this.val();
                        if(this.value != value) {
                            this.updateWidget();
                        }
                    });

                }
                else {
                    this.$elem = $('<div class="sb-ui-textarea" />');

                    if(this.config.hasOwnProperty('height') && this.config.height > 0) {
                        this.$elem.css({height: this.config.height+'px'});
                    }

                    let $editor = $('<div quill__editor></div>');

                    this.$elem.append($editor);

                    this.getLayout().getView().isReady().then( () => {
                        // init inline styling
                        const ColorStyle = Quill.import('attributors/style/color');
                        const SizeStyle  = Quill.import('attributors/style/size');
                        const AlignStyle = Quill.import('attributors/style/align');

                        Quill.register(ColorStyle, true);
                        Quill.register(SizeStyle, true);
                        Quill.register(AlignStyle, true);


                        const Inline = Quill.import('blots/inline');
                        class SmallBlot extends Inline {
                            static blotName = 'small';
                            static tagName = 'small';
                        }
                        class BigBlot extends Inline {
                            static blotName = 'big';
                            static tagName = 'big';
                        }

                        Quill.register(SmallBlot);
                        Quill.register(BigBlot);

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
//                                    [{ 'size': ['small', false, 'large', 'huge'] }],
                                    [
                                        'small',
                                        'big',
                                        { 'color': ['#000000', '#e60000', '#ff9900', '#ffff00', '#008a00', '#0066cc', false] },
                                        { 'background': ['#fff59d', '#fd4444', '#a5d6a7', '#81d4fa', '#ffccbc', false] }
                                    ],
                                    ['fullscreen']
                                ]
                            }
                        });

                        this.$elem.find('.ql-small').html(`
                                <svg viewBox="0 0 18 18" width="18" height="18">
                                    <text x="2" y="14" font-size="10" font-family="sans-serif">A</text>
                                </svg>
                            `);

                        this.$elem.find('.ql-big').html(`
                                <svg viewBox="0 0 18 18" width="18" height="18">
                                    <text x="1" y="15" font-size="16" font-family="sans-serif">A</text>
                                </svg>
                            `);

                        this.$elem.find('.ql-fullscreen').on('click', () => {
                            let elem: any = this.$elem[0];
                            if (elem.requestFullscreen) {
                                elem.requestFullscreen();
                            }
                            else if (elem.hasOwnProperty('webkitRequestFullscreen')) {
                                elem['webkitRequestFullscreen']();
                            }
                        });

                        this.$elem.find('.ql-formats *').attr('tabindex', -1);

                        this.$elem.data('quill', editor);

                        editor.root.innerHTML = this.adaptIn(value);

                        let timeout: any;
                        let initial_change = true;

                        editor.on('text-change', (delta, source) => {
                            this.value = editor.root.innerHTML;
                            // update value without refreshing the layout
                            if(this.value != value) {
                                // debounce updates
                                if(timeout) {
                                    clearTimeout(timeout);
                                }
                                if(!initial_change) {
                                    timeout = setTimeout( () => {
                                        this.updateWidget();
                                        // we set timeout to 1s as debounce (there is no hurry here)
                                    }, 1000);
                                }
                                initial_change = false;
                            }
                        });

                        // add support for silent copy-paste
                        editor.root.addEventListener('paste', () => {
                            setTimeout(() => {
                                // simulate a text-change if content was actually updated
                                this.value = editor.root.innerHTML;
                                if(this.value != value) {
                                    if (timeout) {
                                        clearTimeout(timeout);
                                    }
                                    timeout = setTimeout(() => {
                                        this.updateWidget();
                                    }, 1000);
                                }
                            }, 100);
                        });

                    });
                }
                break;
            case 'view':
            default:
                if(this.config.layout == 'list') {
                    value = $("<div/>").html(this.adaptIn(value)).text();
                    this.$elem = UIHelper.createInputView('text_' + this.id, this.label, value, this.config.description);
                    this.$elem.attr('title', value);
                }
                else {
                    this.$elem = $('<div class="sb-ui-textarea" />');
                    // convert breaks to <br /> only if usage is text/plain
                    this.$elem.append( $('<div class="textarea-content" />').html(this.adaptIn(value)) );
                    if(this.config.hasOwnProperty('height') && this.config.height > 0) {
                        this.$elem.css({height: this.config.height + 'px'});
                    }
                }
                break;
        }

        if(this.config.layout != 'list') {
            this.$elem.append( $('<div class="textarea-title" />').text(this.label) );
        }

        return this.$elem
            .addClass('sb-widget')
            .addClass('sb-widget-mode-' + this.mode)
            .attr('id', this.getId())
            .attr('data-type', this.config.type)
            .attr('data-field', this.config.field)
            .attr('data-usage', this.config.usage || '');
    }

    private getUsage(): string {
        let usage: string = 'text/plain';
        if(this.config.hasOwnProperty('usage')) {
            // extract type/subtype, ignoring any tree.subtree:params
            const usageMatch = String(this.config.usage).match(/^([^.:]+)/);
            if(usageMatch) {
                usage = usageMatch[1].trim();
            }
        }
        return usage;
    }

    /**
     * Adapt received to HTML (that will be processed by Quill)
     */
    private adaptIn(value: string): string {
        let result: string = value;
        let usage: string = this.getUsage();
        let mode = (this.readonly && this.config.layout == 'form') ? 'view' : this.mode;

        switch(mode) {
            case 'edit':
                if(usage.includes('text/html')) {
                    // #memo - if generated at the back-end, it will be converted only once
                    result = result.trim()
                        // normalize CRLF
                        .replace(/\r\n?/g, '\n');

                    // convert <br> to end/start of paragraph
                    result = result.replace(/<br\s*\/?>/gi, '</p><p>');

                    // ensure everything is within a paragraph
                    if (!/^<p[\s>]/i.test(result)) {
                        result = `<p>${result}`;
                    }
                    if (!/<\/p>\s*$/i.test(result)) {
                        result = `${result}</p>`;
                    }
                }
                break;
            case 'view':
                // #memo - we don't use Quill here
                if(usage.includes('text/plain')) {
                    result = value.replace(/(?:\r\n|\r|\n)/g, '<br />');
                }
                else if(usage.includes('text/json')) {
                    const escaped = result
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;");
                    result = `<pre><code class="language-json">${escaped}</code></pre>`;
                }
                break;
        }

        return result;
    }

    /**
     * Here Mode is implicitly 'edit'
     */
    private adaptOut(): string {
        let result: string = this.value;
        let usage: string = this.getUsage();

        if(this.$elem.data('quill')) {
            const editor = this.$elem.data('quill');
            if(usage.includes('text/html')) {
                // leave unchanged : this will not require any Quill processing at next load
                /*
                const container = document.createElement('div');
                container.innerHTML = result;
                result = Array.from(container.querySelectorAll('p'))
                    .map(p => p.innerHTML)
                    .join('<br/>');
                */
            }
            else {
                // use getText to remove html tags
                result = editor.getText().trim();
            }
        }

        return result;
    }

}