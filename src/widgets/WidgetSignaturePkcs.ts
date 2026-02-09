import Widget from "./Widget";
import { View, Layout } from "../equal-lib";
import { UIHelper } from '../material-lib';
import * as webeid from '@web-eid/web-eid-library/web-eid.js';

interface WebEidError extends Error {
    code?: webeid.ErrorCode;
    requiresUpdate?: {
        extension?: boolean;
        nativeApp?: boolean;
    };
    nativeException?: any;
}

interface WebEidSignatureAlgorithm {
    hashFunction: string;
    paddingScheme: string;
    cryptoAlgorithm: string;
}


type CryptoAlgorithm = 'RSA' | 'ECC';
type PaddingScheme   = 'PKCS1.5' | 'PSS' | 'NONE';
type HashFunction =
    | 'SHA-224' | 'SHA-256' | 'SHA-384' | 'SHA-512'
    | 'SHA3-224' | 'SHA3-256' | 'SHA3-384' | 'SHA3-512';


interface OIDResult {
    oid: string;                 // sig_algorithm_oid
    note?: string;               // messages d’avertissement/infos
    needsParamsDer?: boolean;    // true pour RSA-PSS (params DER requis côté serveur)
}

export default class WidgetSignaturePkcs extends Widget {

    private bytesToBase64(bytes: Uint8Array): string {
        let bin = '';
        for (let i = 0; i < bytes.length; i++) {
            bin += String.fromCharCode(bytes[i]);
        }
        return btoa(bin);
    }

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, label, value, config);
    }

    public render(): JQuery {
        let value:string = this.value ? this.value : '';
        const lang = navigator.language.substring(0, 2);

        this.$elem = $('<div />').addClass('sb-ui-signaturePkcs');

        this.$elem.append( $('<div class="textarea-content" />')
            .css({height: this.config.height + 'px'})
            .html(value.replace(/(?:\r\n|\r|\n)/g, '<br />')) );

        // a signature can never be changed
        if(value.length) {
            this.mode = 'view';
        }

        switch(this.mode) {
            case 'edit':

                let $signButton = UIHelper.createButton('sign-button_' + this.id, 'Sign', 'outlined').css({ 'margin-top': '8px' });
                this.$elem.append($signButton);

                $signButton.on('click', async () => {

                        // Liste des algorithmes supportés côté système (application)
                        const systemSupportedSignatureAlgorithms: WebEidSignatureAlgorithm[] = [
                            // #memo - RSA is the preferred Algorithm  & SHA-256 is the preferred hash function
                            // as of 2026-01-01, this config universally accepted
                            { cryptoAlgorithm: 'RSA', hashFunction: 'SHA-256', paddingScheme: 'PKCS1.5' },
                            // since the document signature relies on the document SHA-256 hash, this method fails if not accepted
                        ];

                        // #memo - doc_hash is a string to be handled as binary and provided as an hexadecimal representation of the hash
                        const doc_hash = this.hexToBase64('b94d07d630fd4e41f9a0cfb5637c21c4ae91f10abb7d3eae119810c125b7e1ce');

                        try {
                            const status = await webeid.status();

                            // #todo - get csrf_nonce (validity 5 min) & store to localStorage

                            // fetch the Signing Certificate and supported hash functions
                            // #memo - supported hash functions depend on the chip version (e.g. eID Belpic-V1.7, Belpic-V1.8, ...)
                            const {
                                certificate,
                                supportedSignatureAlgorithms
                            } = await webeid.getSigningCertificate({lang});

                            console.log(certificate, supportedSignatureAlgorithms);

                            // Check if there is at least one common algorithm between those supported by the system and the card
                            const selectedAlgorithm = systemSupportedSignatureAlgorithms.find(sysAlgo =>
                                supportedSignatureAlgorithms.find((cardAlgo: any) =>
                                    cardAlgo.cryptoAlgorithm === sysAlgo.cryptoAlgorithm &&
                                    cardAlgo.hashFunction === sysAlgo.hashFunction &&
                                    cardAlgo.paddingScheme === sysAlgo.paddingScheme
                                )
                            );

                            if(!selectedAlgorithm) {
                                console.error("Aucun algorithme compatible entre le système et la carte eID.");
                                return;
                            }

                            console.debug('Selected algorithm', selectedAlgorithm);
                            console.debug('computed base64 doc_hash', doc_hash);
                            console.debug('should be ', 'uU0H1jD9TkH5oM+1Y3whxK6R8Qq7fT6uEZgQwSW34c4=');

                            const {
                                signature,
                                signatureAlgorithm
                            } = await webeid.sign(certificate, doc_hash, selectedAlgorithm.hashFunction, {lang});

                            console.log(signature, signatureAlgorithm);

                            const sig_algo_oid: string = this.getOidFromAlgorithm(signatureAlgorithm);
                            // this.$elem.trigger('_updatedWidget', [false]);



                            // #memo - le csrf_nonce  doit être présent dans la requête

                            // build response body
                            const body = {
                                // binary, base64 encoded
                                sig_cert: certificate,
                                // string, according to possible DocumentSignature::sig_algo selection
                                sig_algo_oid: sig_algo_oid,
                                // string, base64 representation of the signature hash
                                sig_hash: signature
                            };

                            console.log('response', body);

                            // const result = await ApiService.call('?do=model_onchange', body);
                        }
                        catch(error: any) {
                            this.handleWebEidError(error, {
                                info: (m: string) => console.info(m),
                                warn: (m: string) => console.warn(m),
                                error: (m: string) => console.error(m),
                                suggest: (m: string) => {
                                    // ex. showToast(m, { variant: "warning" });
                                    console.log("[UI suggestion]", m);
                                },
                            });
                        }
                        finally {
                            // remove csrf_nonce from localStorage
                        }
                    });

                break;
            case 'view':
            default:
        }

        return this.$elem
            .addClass('sb-widget')
            .addClass('sb-widget-mode-' + this.mode)
            .attr('id', this.getId())
            .attr('data-type', this.config.type)
            .attr('data-field', this.config.field)
            .attr('data-usage', this.config.usage || '');
    }

    private handleWebEidError(err: any, ui: any = {}): void {
        const { info = console.info, warn = console.warn, error = console.error, suggest = console.info } = ui;
        const e = err as WebEidError;
        const code: webeid.ErrorCode | undefined = e?.code;

        console.debug('Original error', e);

        if(!code) {
            error("Web eID – erreur inconnue (sans code): " + e);
            suggest("Veuillez réessayer. Si le problème persiste, contactez le support.");
            return;
        }

        switch(code) {
            // --- Timeout errors ---
            case "ERR_WEBEID_ACTION_TIMEOUT":
                error("Web eID – délai d’action dépassé (extension n’a pas répondu à temps).");
                suggest("Veuillez réessayer. Si cela se reproduit, signalez le problème (bug).");
                break;

            case "ERR_WEBEID_USER_TIMEOUT":
                info("Web eID – délai utilisateur dépassé (PIN non saisi ou non annulé).");
                suggest("La session a expiré. Merci de relancer et d’entrer votre code PIN.");
                break;

            // --- Health errors ---
            case "ERR_WEBEID_VERSION_MISMATCH":
                warn("Web eID – versions non correspondantes entre extension/app native.");
                const needsExt = e.requiresUpdate?.extension;
                const needsApp = e.requiresUpdate?.nativeApp;

                if (needsExt) {
                    suggest("Mettez à jour l’extension Web eID de votre navigateur puis réessayez.");
                }
                if (needsApp) {
                    suggest("Mettez à jour l’application native Web eID puis réessayez.");
                }
                // si rien de renseigné, donner une consigne générique
                if (!needsExt && !needsApp) {
                    suggest("Mettez à jour Web eID (extension et/ou application native), puis réessayez.");
                }
                break;

            case "ERR_WEBEID_VERSION_INVALID":
                error("Web eID – version de l’application native invalide (handshake).");
                suggest("Veuillez signaler ce problème (bug) au support.");
                break;

            case "ERR_WEBEID_EXTENSION_UNAVAILABLE":
                warn("Web eID – extension introuvable / n’a pas répondu au handshake.");
                suggest("Installez l’extension Web eID pour votre navigateur, puis réessayez.");
                break;

            case "ERR_WEBEID_NATIVE_UNAVAILABLE":
                warn("Web eID – application native indisponible (échec handshake).");
                suggest("Installez l’application native Web eID sur votre machine, puis réessayez.");
                break;

            case "ERR_WEBEID_UNKNOWN_ERROR":
                error("Web eID – erreur inconnue.");
                suggest("Veuillez réessayer. Si le problème persiste, signalez le bug.");
                break;

            // --- Security errors ---
            case "ERR_WEBEID_CONTEXT_INSECURE":
                warn("Web eID – contexte non sécurisé.");
                suggest("Utilisez le site via HTTPS (contexte sécurisé) puis réessayez.");
                break;

            // --- Third party errors ---
            case "ERR_WEBEID_USER_CANCELLED":
                info("Web eID – opération annulée par l’utilisateur (sélection certif / PIN / etc.).");
                // Ici, ne rien forcer: respecter la décision de l’utilisateur.
                break;

            case "ERR_WEBEID_NATIVE_INVALID_ARGUMENT":
                error("Web eID – argument invalide envoyé à l’application native.");
                suggest("Incident journalisé. Vérifiez les paramètres envoyés côté backend (ex: nonce trop court).");
                break;

            case "ERR_WEBEID_NATIVE_FATAL":
                error("Web eID – erreur fatale de l’application native (lecteur carte ?).");
                suggest("Réessayez. Si le problème persiste, redémarrez le lecteur/carte ou réinstallez l’app native.");
                break;

            // --- Developer mistakes ---
            case "ERR_WEBEID_ACTION_PENDING":
                info("Web eID – une action du même type est déjà en cours.");
                suggest("Patientez: l’action actuelle doit se terminer avant d’en lancer une autre.");
                break;

            case "ERR_WEBEID_MISSING_PARAMETER":
                error("Web eID – paramètre requis manquant lors de l’appel de la bibliothèque.", e);
                suggest("Vérifiez la documentation et les paramètres fournis à la fonction.");
                break;

            default:
                // Garde-fou pour d’éventuels nouveaux codes
                error(`Web eID – code d’erreur non pris en charge: ${code}`);
                suggest("Veuillez réessayer. Si cela persiste, contactez le support.");
                break;
        }
    }

    private getOidFromAlgorithm(signatureAlgorithm: WebEidSignatureAlgorithm): string {

        // --- ECDSA (ECC) — no padding
        if(signatureAlgorithm.cryptoAlgorithm === 'ECC') {
            switch (signatureAlgorithm.hashFunction) {
                case 'SHA-224':  return '1.2.840.10045.4.3.1';  // ecdsa-with-SHA224
                case 'SHA-256':  return '1.2.840.10045.4.3.2';  // ecdsa-with-SHA256
                case 'SHA-384':  return '1.2.840.10045.4.3.3';  // ecdsa-with-SHA384
                case 'SHA-512':  return '1.2.840.10045.4.3.4';  // ecdsa-with-SHA512
                case 'SHA3-224': return '1.2.840.10045.4.3.7';  // ecdsa-with-SHA3-224
                case 'SHA3-256': return '1.2.840.10045.4.3.8';  // ecdsa-with-SHA3-256
                case 'SHA3-384': return '1.2.840.10045.4.3.9';  // ecdsa-with-SHA3-384
                case 'SHA3-512': return '1.2.840.10045.4.3.10'; // ecdsa-with-SHA3-512
                // ECDSA hash not supported
                default:         return '';
            }
        }

        // --- RSA PKCS#1 v1.5
        if(signatureAlgorithm.cryptoAlgorithm === 'RSA' && signatureAlgorithm.paddingScheme === 'PKCS1.5') {
            switch(signatureAlgorithm.hashFunction) {
                case 'SHA-224':  return '1.2.840.113549.1.1.14'; // sha224WithRSAEncryption
                case 'SHA-256':  return '1.2.840.113549.1.1.11'; // sha256WithRSAEncryption
                case 'SHA-384':  return '1.2.840.113549.1.1.12'; // sha384WithRSAEncryption
                case 'SHA-512':  return '1.2.840.113549.1.1.13'; // sha512WithRSAEncryption
                // RSA + SHA-3 (PKCS#1 v1.5)
                case 'SHA3-224': return '2.16.840.1.101.3.4.3.13'; // sha3-224WithRSAEncryption
                case 'SHA3-256': return '2.16.840.1.101.3.4.3.14'; // sha3-256WithRSAEncryption
                case 'SHA3-384': return '2.16.840.1.101.3.4.3.15'; // sha3-384WithRSAEncryption
                case 'SHA3-512': return '2.16.840.1.101.3.4.3.16'; // sha3-512WithRSAEncryption
                // Hash RSA PKCS#1 v1.5 not supported
                default:         return '';
            }
        }

        // --- RSA-PSS — OID fixe; les paramètres DER (hash, MGF1, saltLen) sont OBLIGATOIRES
        if(signatureAlgorithm.cryptoAlgorithm === 'RSA' && signatureAlgorithm.paddingScheme === 'PSS') {
            // #memo - RSA-PSS also required AlgorithmIdentifier params DER (hash, MGF1, saltLen)'
            return '1.2.840.113549.1.1.10'; // rsassaPss
        }

        // unknown combination algo/padding/hash
        return '';
    }

    private hexToBase64(hex: string): string {
        const matches = hex.match(/[\da-f]{2}/gi);
        if(matches) {
            const binary = matches.map(h => String.fromCharCode(parseInt(h, 16))).join('');
            return btoa(binary);
        }
        return '';
    }

}
