(function ($, Drupal, drupalSettings, once) {
  Drupal.behaviors.testConfigWindow = {
    attach: function (context, settings) {
      $(once('testconfig', '.testconfig', context)).on('click', function() {
        const baseUrl         = drupalSettings.miniorange_saml.base_url;
        const testConfigUrl   = '/testConfig/?idp=';
        const samlResponseUrl = '/showSAMLresponse/?idp=';
        const samlRequestUrl  = '/showSAMLrequest/?idp=';

        let urlType = $(this).attr('url-type');
        let idpName = $(this).attr('idp-name');
        let queryParameter = '';

        switch (urlType) {
          case 'saml-response':
            queryParameter = samlResponseUrl;
            break;

          case 'saml-request':
            queryParameter = samlRequestUrl;
            break;

          default:
            queryParameter = testConfigUrl;
            break;
        }

        let testUrl = baseUrl + queryParameter + idpName;
        window.open(testUrl, "TEST SAML IDP", "scrollbars=1 width=800, height=600");
      });
    }
  };
})(jQuery, Drupal, drupalSettings, once);
