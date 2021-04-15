/* exported update_channels */

'use strict';

(function (exports) {

exports.update_channels = [
  {
    name: 'EFF (Full)',
    jwk: {
      kty: 'RSA',
      e: 'AQAB',
      n: '1cwvFQu3Kw-Pz8bcEFuV5zx0ZheDsc4Tva7Qv6BL90_sDLqCW79Y543nDkPtNVfFH_89pt2kSPp_IcS5XnYiw6zBQeFuILFw5JpvZt14K0s4' +
        'e025Q9CXfhYKIBKT9PnqihwAacjMa6rQb7RTu7XxVvqxRb3b0vx2CR40LSlYZ8H_KpeaUwq2oz-fyrI6LFTeYvbO3ZuLKeK5xV1a32xeTVMF' +
        'kIj3LxnQalxq-DRHfj7LRRoTnbRDW4uoDc8aVpLFliuO79jUKbobz4slpiWJ4wjKR_O6OK13HbZUiOSxi8Bms-UqBPOyzbMVpmA7lv_zWdaL' +
        'u1IVlVXQyLVbbrqI6llRqfHdcJoEl-eC48AofuB-relQtjTEK_hyBf7sPwrbqAarjRjlyEx6Qy5gTXyxM9attfNAeupYR6jm8LKm6TFpfWky' +
        'DxUmj_f5pJMBWNTomV74f8iQ2M18_KWMUDCOf80tR0t21Q1iCWdvA3K_KJn05tTLyumlwwlQijMqRkYuao-CX9L3DJIaB3VPYPTSIPUr7oi1' +
        '6agsuamOyiOtlZiRpEvoNg2ksJMZtwnj5xhBQydkdhMW2ZpHDzcLuZlhJYZL_l3_7wuzRM7vpyA9obP92CpZRFJErGZmFxJC93I4U9-0B0wg' +
        '-sbyMKGJ5j1BWTnibCklDXtWzXtuiz18EgE'
    },
    update_path_prefix: 'https://www.https-rulesets.org/v1/',
    scope: '',
    replaces_default_rulesets: true
  },
  {
    name: 'DuckDuckGo Smarter Encryption',
    format: 'bloom',
    jwk: {
      kty: 'RSA',
      e: 'AQAB',
      n: '1cwvFQu3Kw-Pz8bcEFuV5zx0ZheDsc4Tva7Qv6BL90_sDLqCW79Y543nDkPtNVfFH_89pt2kSPp_IcS5XnYiw6zBQeFuILFw5JpvZt14K0s4' +
        'e025Q9CXfhYKIBKT9PnqihwAacjMa6rQb7RTu7XxVvqxRb3b0vx2CR40LSlYZ8H_KpeaUwq2oz-fyrI6LFTeYvbO3ZuLKeK5xV1a32xeTVMF' +
        'kIj3LxnQalxq-DRHfj7LRRoTnbRDW4uoDc8aVpLFliuO79jUKbobz4slpiWJ4wjKR_O6OK13HbZUiOSxi8Bms-UqBPOyzbMVpmA7lv_zWdaL' +
        'u1IVlVXQyLVbbrqI6llRqfHdcJoEl-eC48AofuB-relQtjTEK_hyBf7sPwrbqAarjRjlyEx6Qy5gTXyxM9attfNAeupYR6jm8LKm6TFpfWky' +
        'DxUmj_f5pJMBWNTomV74f8iQ2M18_KWMUDCOf80tR0t21Q1iCWdvA3K_KJn05tTLyumlwwlQijMqRkYuao-CX9L3DJIaB3VPYPTSIPUr7oi1' +
        '6agsuamOyiOtlZiRpEvoNg2ksJMZtwnj5xhBQydkdhMW2ZpHDzcLuZlhJYZL_l3_7wuzRM7vpyA9obP92CpZRFJErGZmFxJC93I4U9-0B0wg' +
        '-sbyMKGJ5j1BWTnibCklDXtWzXtuiz18EgE'
    },
    update_path_prefix: 'https://www.https-rulesets.org/ddg/',
    scope: '',
  }
];

})(typeof exports === 'undefined' ? require.scopes.update_channels = {} : exports);
