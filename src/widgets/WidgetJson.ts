import Widget from './Widget';
import { Layout } from '../equal-lib';
import JsonCodec, { JsonParseResult, JsonPrimitive, JsonValue } from './JsonCodec';

type JsonEditorMode = 'structured' | 'raw';
type JsonPath = Array<string | number>;

export default class WidgetJson extends Widget {

    private draftText: string = '';
    private draftValue: JsonValue | undefined;
    private editorMode: JsonEditorMode = 'structured';
    private validationError: string | null = null;
    private updateTimeout: any = null;
    private pendingChange: boolean = false;
    private flushPromise: Promise<void> | null = null;
    private copyFeedbackTimeout: any = null;

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, label, value, config);
    }

    public change(value: any) {
        const parsed = this.initializeDraft(value);
        if(this.mode === 'edit') {
            const $input = this.$elem.find('.sb-json-raw-input');
            if($input.length) {
                $input.val(this.draftText).trigger('input').trigger('change');
            }
        }
        else {
            this.updateViewContent(parsed);
        }
        return this;
    }

    public validate(): string | null {
        if(this.editorMode === 'raw') {
            const parsed = JsonCodec.parse(this.draftText);
            this.validationError = parsed.valid ? null : parsed.error;
        }
        this.applyValidationState();
        return this.validationError;
    }

    public async flushPendingChange(): Promise<void> {
        if(this.flushPromise) {
            await this.flushPromise;
            return;
        }

        if(this.validate() || !this.pendingChange) {
            return;
        }

        if(this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }

        const parsed = JsonCodec.parse(this.draftText);
        if(!parsed.valid) {
            return;
        }

        this.pendingChange = false;
        this.value = parsed.normalized;
        this.draftText = parsed.normalized;
        this.$elem.find('.sb-json-raw-input').val(this.draftText);

        const result = this.$elem.triggerHandler('_updatedWidget', [false]);
        if(result && typeof result.then === 'function') {
            const promise = Promise.resolve(result).then(() => undefined);
            this.flushPromise = promise;
            try {
                await promise;
            }
            finally {
                if(this.flushPromise === promise) {
                    this.flushPromise = null;
                }
            }
        }
    }

    public destroy() {
        if(this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }
        if(this.copyFeedbackTimeout) {
            clearTimeout(this.copyFeedbackTimeout);
            this.copyFeedbackTimeout = null;
        }
        super.destroy();
    }

    public render(): JQuery {
        const parsed = this.initializeDraft(this.value);
        const effectiveMode = (this.readonly && this.config.layout === 'form') ? 'view' : this.mode;

        this.$elem = $('<div />')
            .addClass('sb-widget sb-widget-type-json sb-widget-mode-' + this.mode)
            .attr('id', this.getId())
            .attr('data-type', this.config.type)
            .attr('data-field', this.config.field)
            .attr('data-usage', this.config.usage || '');

        if(effectiveMode === 'edit') {
            if(this.config.layout === 'list') {
                this.editorMode = 'raw';
                this.renderRawEditor(this.$elem, true);
            }
            else {
                this.renderFormEditor(parsed);
            }
        }
        else {
            this.renderView(parsed);
        }

        this.applyValidationState();
        return this.$elem;
    }

    private initializeDraft(value: any): JsonParseResult {
        if(this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }
        const parsed = JsonCodec.parse(value);
        this.draftText = parsed.normalized;
        this.draftValue = parsed.value;
        this.validationError = parsed.valid ? null : parsed.error;
        this.pendingChange = false;

        if(!parsed.valid || parsed.empty) {
            this.editorMode = 'raw';
        }
        return parsed;
    }

    private renderView(parsed: JsonParseResult): void {
        if(this.config.layout === 'list') {
            const value = parsed.valid && !parsed.empty && parsed.value !== undefined
                ? JsonCodec.compact(parsed.value)
                : parsed.normalized;
            this.$elem
                .addClass('sb-json-list-value sb-string-flow')
                .text(value)
                .attr('title', parsed.valid ? parsed.normalized : (parsed.error ?? value));
            return;
        }

        this.$elem.addClass('sb-ui-json');
        this.$elem.append(
            this.createHeader(),
            $('<pre class="sb-json-view" />').append(
                $('<code class="language-json" />').text(parsed.normalized)
            ),
            this.createHelper()
        );
    }

    private updateViewContent(parsed: JsonParseResult): void {
        if(this.config.layout === 'list') {
            const value = parsed.valid && !parsed.empty && parsed.value !== undefined
                ? JsonCodec.compact(parsed.value)
                : parsed.normalized;
            this.$elem.text(value).attr('title', parsed.valid ? parsed.normalized : (parsed.error ?? value));
        }
        else {
            this.$elem.find('.sb-json-view code').text(parsed.normalized);
        }
        this.applyValidationState();
    }

    private renderFormEditor(parsed: JsonParseResult): void {
        this.$elem.addClass('sb-ui-json');

        const $structuredButton = $('<button type="button" class="sb-json-editor-toggle" />')
            .attr('data-editor', 'structured')
            .text('Structured')
            .on('click', () => this.switchEditor('structured'));
        const $rawButton = $('<button type="button" class="sb-json-editor-toggle" />')
            .attr('data-editor', 'raw')
            .text('JSON text')
            .on('click', () => this.switchEditor('raw'));

        const $editorToggleGroup = $('<div class="sb-json-editor-toggle-group" />')
            .append($structuredButton, $rawButton);

        this.$elem.append(
            this.createHeader($editorToggleGroup),
            $('<div class="sb-json-editor-body" />'),
            this.createHelper()
        );

        if(!parsed.valid || parsed.empty) {
            this.editorMode = 'raw';
        }
        this.renderEditorBody();
    }

    private createHeader($editorToggleGroup?: JQuery): JQuery {
        const $copyIcon = $('<span class="material-icons" aria-hidden="true" />').text('content_copy');
        const $copyButton = $('<button type="button" class="sb-json-header-action" />')
            .attr({
                'aria-label': 'Copy JSON',
                'title': 'Copy JSON'
            })
            .append($copyIcon)
            .on('click', () => {
                void this.copyJsonToClipboard($copyButton, $copyIcon);
            });

        const $fullscreenIcon = $('<span class="material-icons" aria-hidden="true" />').text('fullscreen');
        const $fullscreenButton = $('<button type="button" class="sb-json-header-action" />')
            .attr({
                'aria-label': 'Enter fullscreen',
                'aria-pressed': 'false',
                'title': 'Enter fullscreen'
            })
            .append($fullscreenIcon)
            .on('click', () => {
                const fullscreen = !this.$elem.hasClass('sb-json-fullscreen');
                this.$elem.toggleClass('sb-json-fullscreen', fullscreen);
                $fullscreenIcon.text(fullscreen ? 'fullscreen_exit' : 'fullscreen');
                $fullscreenButton.attr({
                    'aria-label': fullscreen ? 'Exit fullscreen' : 'Enter fullscreen',
                    'aria-pressed': String(fullscreen),
                    'title': fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
                });
            });

        const $controls = $('<div class="sb-json-header-controls" />');
        if($editorToggleGroup) {
            $controls.append($editorToggleGroup);
        }
        $controls.append(
            $('<div class="sb-json-header-actions" />').append($copyButton, $fullscreenButton)
        );

        return $('<div class="sb-json-header" />').append(
            $('<div class="sb-json-title" />').text(this.label),
            $controls
        );
    }

    private async copyJsonToClipboard($button: JQuery, $icon: JQuery): Promise<void> {
        const value = this.draftText;

        if(navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            try {
                await navigator.clipboard.writeText(value);
            }
            catch(error) {
                console.debug('WidgetJson::copyJsonToClipboard fallback to execCommand', error);
                this.copyJsonWithExecCommand(value);
            }
        }
        else {
            this.copyJsonWithExecCommand(value);
        }

        if(this.copyFeedbackTimeout) {
            clearTimeout(this.copyFeedbackTimeout);
        }
        $icon.text('done');
        $button.attr({'aria-label': 'Copied', 'title': 'Copied'});
        this.copyFeedbackTimeout = setTimeout(() => {
            $icon.text('content_copy');
            $button.attr({'aria-label': 'Copy JSON', 'title': 'Copy JSON'});
            this.copyFeedbackTimeout = null;
        }, 1200);
    }

    private copyJsonWithExecCommand(value: string): void {
        const $temporaryInput = $('<textarea readonly />')
            .css({position: 'fixed', left: '-9999px'})
            .val(value)
            .appendTo('body');
        const temporaryInput = $temporaryInput[0] as HTMLTextAreaElement;
        temporaryInput.select();
        try {
            document.execCommand('copy');
        }
        finally {
            $temporaryInput.remove();
        }
    }

    private switchEditor(mode: JsonEditorMode): void {
        if(mode === this.editorMode) {
            return;
        }

        if(mode === 'structured') {
            const parsed = JsonCodec.parse(this.draftText);
            if(!parsed.valid || parsed.empty || parsed.value === undefined) {
                this.validationError = parsed.error ?? 'A JSON value is required for structured editing.';
                this.applyValidationState();
                return;
            }
            this.draftValue = parsed.value;
            this.draftText = parsed.normalized;
            this.value = parsed.normalized;
            this.validationError = null;
        }

        this.editorMode = mode;
        this.renderEditorBody();
        this.applyValidationState();
    }

    private renderEditorBody(): void {
        const $body = this.$elem.find('.sb-json-editor-body').empty();
        this.$elem.find('.sb-json-editor-toggle')
            .removeClass('is-active')
            .filter(`[data-editor="${this.editorMode}"]`)
            .addClass('is-active');

        if(this.editorMode === 'raw') {
            this.renderRawEditor($body, false);
        }
        else if(this.draftValue !== undefined) {
            $body.append(this.renderStructuredNode(this.draftValue, [], ''));
        }
    }

    private renderRawEditor($container: JQuery, inline: boolean): void {
        const $input = inline
            ? $('<input type="text" class="sb-json-raw-input" spellcheck="false" />')
            : $('<textarea class="sb-json-raw-input" rows="10" spellcheck="false" />');

        $input
            .val(this.draftText)
            .prop('disabled', this.readonly)
            .on('input', (event) => this.onRawInput(String($(event.currentTarget).val() ?? '')))
            .on('change blur', () => {
                void this.flushPendingChange();
            });

        $container.append($input);
        if(inline) {
            $container.addClass('sb-json-inline-editor');
        }
    }

    private onRawInput(value: string): void {
        this.draftText = value;
        const parsed = JsonCodec.parse(value);
        this.validationError = parsed.valid ? null : parsed.error;

        if(parsed.valid) {
            this.draftValue = parsed.value;
            this.value = parsed.normalized;
            this.scheduleChange();
        }
        else {
            this.cancelPendingChange();
        }
        this.applyValidationState();
    }

    private renderStructuredNode(value: JsonValue, path: JsonPath, label: string): JQuery {
        if(Array.isArray(value)) {
            const $node = $('<div class="sb-json-node sb-json-node-container" />');
            const $children = $('<div class="sb-json-node-children" />');
            $node.append(this.createContainerHeading(label, `[${value.length}]`, $children), $children);
            value.forEach((item, index) => {
                $children.append(this.renderStructuredNode(item, [...path, index], String(index)));
            });
            return $node;
        }

        if(value !== null && typeof value === 'object') {
            const keys = Object.keys(value);
            const $node = $('<div class="sb-json-node sb-json-node-container" />');
            const $children = $('<div class="sb-json-node-children" />');
            $node.append(this.createContainerHeading(label, `{${keys.length}}`, $children), $children);
            keys.forEach((key) => {
                $children.append(this.renderStructuredNode(value[key], [...path, key], key));
            });
            return $node;
        }

        const $row = $('<div class="sb-json-node sb-json-node-value" />');
        $row.append($('<span class="sb-json-node-key" />').text(label));

        if(typeof value === 'string') {
            const $input = $('<input type="text" class="sb-json-value-input" />').val(value);
            $input.on('input', (event) => {
                this.updateStructuredValue(path, String($(event.currentTarget).val() ?? ''));
            });
            $row.append($input);
        }
        else if(typeof value === 'number') {
            const $input = $('<input type="number" step="any" class="sb-json-value-input" />').val(String(value));
            $input.on('input', (event) => {
                const raw = String($(event.currentTarget).val() ?? '');
                const parsed = JsonCodec.parse(raw);
                if(parsed.valid && typeof parsed.value === 'number') {
                    this.updateStructuredValue(path, parsed.value);
                }
                else {
                    this.validationError = parsed.error ?? 'A number is required.';
                    this.cancelPendingChange();
                    this.applyValidationState();
                }
            });
            $row.append($input);
        }
        else if(typeof value === 'boolean') {
            const $input = $('<input type="checkbox" class="sb-json-value-boolean" />').prop('checked', value);
            $input.on('change', (event) => {
                this.updateStructuredValue(path, $(event.currentTarget).is(':checked'));
            });
            $row.append($input);
        }
        else {
            $row.append($('<span class="sb-json-value-null" />').text('null'));
        }

        return $row;
    }

    private createContainerHeading(label: string, count: string, $children: JQuery): JQuery {
        const nodeName = label || 'root';
        const $toggle = $('<button type="button" class="sb-json-node-toggle" />')
            .text('−')
            .attr({
                'aria-expanded': 'true',
                'aria-label': `Collapse ${nodeName}`,
                'title': `Collapse ${nodeName}`
            })
            .on('click', () => {
                const expanded = $toggle.attr('aria-expanded') === 'true';
                $toggle
                    .text(expanded ? '+' : '−')
                    .attr({
                        'aria-expanded': String(!expanded),
                        'aria-label': `${expanded ? 'Expand' : 'Collapse'} ${nodeName}`,
                        'title': `${expanded ? 'Expand' : 'Collapse'} ${nodeName}`
                    });
                $children.toggle(!expanded);
            });

        const headingText = label ? `${label} ${count}` : count;
        return $('<div class="sb-json-node-heading" />').append(
            $toggle,
            $('<span class="sb-json-node-heading-label" />').text(headingText)
        );
    }

    private updateStructuredValue(path: JsonPath, value: JsonPrimitive): void {
        if(path.length === 0) {
            this.draftValue = value;
        }
        else {
            let target: any = this.draftValue;
            for(let index = 0; index < path.length - 1; ++index) {
                target = target[path[index]];
            }
            target[path[path.length - 1]] = value;
        }

        this.draftText = JSON.stringify(this.draftValue, null, 4);
        this.value = this.draftText;
        this.validationError = null;
        this.applyValidationState();
        this.scheduleChange();
    }

    private scheduleChange(): void {
        if(this.updateTimeout) {
            clearTimeout(this.updateTimeout);
        }
        this.pendingChange = true;
        this.updateTimeout = setTimeout(() => {
            void this.flushPendingChange();
        }, 500);
    }

    private cancelPendingChange(): void {
        if(this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }
        this.pendingChange = false;
    }

    private createHelper(): JQuery {
        return $('<div class="mdc-text-field-helper-line" />').append(
            $('<div class="mdc-text-field-helper-text" aria-hidden="true" />')
                .text(this.config.description ?? '')
                .attr('title', this.config.description ?? '')
        );
    }

    private applyValidationState(): void {
        if(!this.$elem || !this.$elem.length) {
            return;
        }

        const $helper = this.$elem.find('.mdc-text-field-helper-text').first();
        if(this.validationError) {
            this.$elem.addClass('sb-widget--invalid mdc-text-field--invalid');
            this.$elem.find('input, textarea')
                .attr('aria-invalid', 'true')
                .attr('title', this.validationError);
            $helper
                .addClass('mdc-text-field-helper-text--persistent mdc-text-field-helper-text--validation-msg')
                .text(this.validationError)
                .attr('title', this.validationError)
                .attr('aria-hidden', 'false');
        }
        else {
            const description = this.config.description ?? '';
            this.$elem.removeClass('sb-widget--invalid mdc-text-field--invalid');
            this.$elem.find('input, textarea')
                .removeAttr('aria-invalid')
                .removeAttr('title');
            $helper
                .removeClass('mdc-text-field-helper-text--persistent mdc-text-field-helper-text--validation-msg')
                .text(description)
                .attr('title', description)
                .attr('aria-hidden', 'true');
        }
    }
}
