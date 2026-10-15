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
            editor.clipboard.dangerouslyPasteHTML(this.adaptIn(value), 'silent');
        }
        return this;
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
                        this.$elem.css({height: this.config.height + 'px'});
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

                        const toolbar = this.getUsage().includes('text/plain')
                            ? false
                            : [
                                ['bold', 'italic', 'underline', 'strike'],
                                ['blockquote'],
                                // [{ 'header': [1, 2, 3, 4, 5, 6, false]}],
                                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                [{ "align": '' }, { "align": 'center' }, { 'align': 'right' }],
                                // [{ 'size': ['small', false, 'large', 'huge'] }],
                                [
                                    'small',
                                    'big',
                                    { 'color': ['#000000', '#e60000', '#ff9900', '#ffff00', '#008a00', '#0066cc', false] },
                                    { 'background': ['#fff59d', '#fd4444', '#a5d6a7', '#81d4fa', '#ffccbc', false] }
                                ],
                                ['fullscreen']
                            ];

                        const editor = new Quill($editor[0], {
                            placeholder: this.config.description,
                            theme: "snow",
                            modules: {
                                toolbar
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
                            if(elem.requestFullscreen) {
                                elem.requestFullscreen();
                            }
                            else if(elem.hasOwnProperty('webkitRequestFullscreen')) {
                                elem['webkitRequestFullscreen']();
                            }
                        });

                        this.$elem.find('.ql-formats *').attr('tabindex', -1);

                        this.$elem.data('quill', editor);

                        editor.clipboard.dangerouslyPasteHTML(this.adaptIn(value), 'silent');

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
                                    this.updateWidget();
                                    // we set timeout to 1s as debounce (there is no hurry here)
                                }, 1000);
                            }
                        });

                        // add support for silent copy-paste
                        editor.root.addEventListener('paste', () => {
                            setTimeout(() => {
                                // simulate a text-change if content was actually updated
                                this.value = editor.root.innerHTML;
                                if(this.value != value) {
                                    if(timeout) {
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

        // #todo - confirm
        // this.applyMultilangIndicator();

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
        let result: string = value ?? '';
        let usage: string = this.getUsage();
        let mode = (this.readonly && this.config.layout == 'form') ? 'view' : this.mode;
        const isHtmlUsage = usage.includes('text/html');
        const isPlainTextUsage = usage.includes('text/plain');

        if(isHtmlUsage) {
            const inputIsPlain = !this.containsHtmlMarkup(result);
            result = inputIsPlain
                ? this.plainTextToHtml(result)
                : this.normalizeInputHtml(result);
        }
        else if(isPlainTextUsage && this.containsHtmlMarkup(result)) {
            result = this.htmlToPlainText(result);
        }

        switch(mode) {
            case 'edit':
                if(!isHtmlUsage) {
                    result = this.plainTextToHtml(result);
                }
                break;
            case 'view':
                // #memo - we don't use Quill here
                if(usage.includes('text/json')) {
                    const escaped = result
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;");
                    result = `<pre><code class="language-json">${escaped}</code></pre>`;
                }
                else if(!isHtmlUsage) {
                    result = this.plainTextToHtml(result);
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
                // Quill already outputs standard semantic tags for the formats enabled above.
                result = this.normalizeOutputHtml(editor.root.innerHTML);
            }
            else {
                // use getText to remove html tags
                result = editor.getText().replace(/\n$/, '');
            }
        }

        return result;
    }

    /**
     * Check whether a value contains something that looks like HTML markup.
     */
    private containsHtmlMarkup(value: string): boolean {
        return /<!--[\s\S]*?-->|<!doctype\b[^>]*>|<\/?[a-z][^>]*>/i.test(value);
    }

    /**
     * Remove legacy HTML from a plain-text value while preserving explicit breaks.
     */
    private htmlToPlainText(value: string): string {
        const container = document.createElement('div');
        container.innerHTML = value.replace(/<br\b[^>]*>/gi, '\n');
        return container.textContent ?? '';
    }

    /**
     * Escape plain text before passing it to an HTML renderer and preserve line breaks.
     */
    private plainTextToHtml(value: string): string {
        return value
            .replace(/\r\n?/g, '\n')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
    }

    /**
     * Normalize equivalent HTML spellings without imposing Quill's block structure.
     */
    private normalizeInputHtml(value: string): string {
        let result = value.trim()
            .replace(/\r\n?/g, '\n')
            .replace(/<br\s*\/?>/gi, '<br>');

        // Quill represents an empty block as <p><br></p>.
        result = result.replace(
            /(<p\b[^>]*>)\s*(?:&nbsp;|\u00a0)?\s*<\/p>/gi,
            '$1<br></p>'
        );

        return result;
    }

    /**
     * Normalize Quill's HTML to a stable, editor-agnostic representation.
     */
    private normalizeOutputHtml(value: string): string {
        let result = value.trim()
            .replace(/\r\n?/g, '\n')
            .replace(/<br\s*\/?>/gi, '<br>');

        const container = document.createElement('div');
        container.innerHTML = result;
        this.flattenParagraphs(container);
        result = container.innerHTML.replace(/<br\s*\/?>/gi, '<br />');

        return result;
    }

    /**
     * Remove Quill's technical paragraphs while preserving logical lines.
     * Paragraphs carrying block formatting are converted to neutral divs.
     */
    private flattenParagraphs(parent: HTMLElement): void {
        const isEmptyParagraph = (paragraph: HTMLElement): boolean => {
            return paragraph.innerHTML
                .replace(/<br\s*\/?>/gi, '')
                .replace(/&nbsp;|&#160;|&#x0*a0;|\u00a0|\s/gi, '') === '';
        };

        const haveSameAttributes = (first: HTMLElement, second: HTMLElement): boolean => {
            return first.attributes.length === second.attributes.length &&
                Array.from(first.attributes).every((attribute) =>
                    second.getAttribute(attribute.name) === attribute.value
                );
        };

        const collectAdjacentElements = (
            first: HTMLElement,
            matches: (element: HTMLElement) => boolean
        ): {elements: HTMLElement[], next: ChildNode | null} => {
            const elements: HTMLElement[] = [];
            let cursor: ChildNode | null = first;

            while(cursor instanceof HTMLElement && matches(cursor)) {
                elements.push(cursor);
                cursor = cursor.nextSibling;
            }

            return {elements, next: cursor};
        };

        const createLogicalLines = (
            elements: HTMLElement[],
            preserveEmptyRun: boolean
        ): DocumentFragment => {
            const fragment = document.createDocumentFragment();
            const emptyElements = elements.map((element) => isEmptyParagraph(element));

            elements.forEach((element, index) => {
                if(index > 0) {
                    fragment.appendChild(document.createElement('br'));
                }
                if(!emptyElements[index]) {
                    while(element.firstChild) {
                        fragment.appendChild(element.firstChild);
                    }
                }
            });

            if(preserveEmptyRun && emptyElements.every(Boolean)) {
                fragment.appendChild(document.createElement('br'));
            }

            return fragment;
        };

        const mergeableInlineTags = new Set([
            'A', 'BIG', 'EM', 'S', 'SMALL', 'SPAN', 'STRONG', 'U'
        ]);

        const flatten = (container: HTMLElement): void => {
            let node: ChildNode | null = container.firstChild;

            while(node) {
                if(!(node instanceof HTMLElement)) {
                    node = node.nextSibling;
                    continue;
                }

                const element = node;

                if(element.tagName === 'BLOCKQUOTE') {
                    const {elements, next} = collectAdjacentElements(
                        element,
                        (candidate) =>
                            candidate.tagName === 'BLOCKQUOTE' &&
                            haveSameAttributes(element, candidate)
                    );
                    elements.forEach((candidate) => flatten(candidate));

                    if(elements.length > 1) {
                        element.appendChild(createLogicalLines(elements, true));
                        elements.slice(1).forEach((candidate) => container.removeChild(candidate));
                    }

                    node = next;
                    continue;
                }

                if(mergeableInlineTags.has(element.tagName)) {
                    const {elements, next} = collectAdjacentElements(
                        element,
                        (candidate) =>
                            candidate.tagName === element.tagName &&
                            haveSameAttributes(element, candidate)
                    );

                    elements.slice(1).forEach((candidate) => {
                        while(candidate.firstChild) {
                            element.appendChild(candidate.firstChild);
                        }
                        container.removeChild(candidate);
                    });
                    flatten(element);

                    node = next;
                    continue;
                }

                if(element.tagName !== 'P') {
                    flatten(element);
                    node = element.nextSibling;
                    continue;
                }

                const hasAttributes = element.attributes.length > 0;
                const {elements, next} = collectAdjacentElements(
                    element,
                    (candidate) =>
                        candidate.tagName === 'P' &&
                        (hasAttributes
                            ? haveSameAttributes(element, candidate)
                            : candidate.attributes.length === 0)
                );
                elements.forEach((candidate) => flatten(candidate));

                const previous = element.previousSibling;
                const fragment = createLogicalLines(
                    elements,
                    hasAttributes || Boolean(previous || next)
                );

                if(hasAttributes) {
                    const replacement = document.createElement('div');
                    Array.from(element.attributes).forEach((attribute) => {
                        replacement.setAttribute(attribute.name, attribute.value);
                    });
                    replacement.appendChild(fragment);

                    container.replaceChild(replacement, element);
                    elements.slice(1).forEach((candidate) => container.removeChild(candidate));
                }
                else {
                    container.insertBefore(fragment, element);
                    elements.forEach((candidate) => container.removeChild(candidate));
                }

                node = next;
            }
        };

        flatten(parent);
    }

}
