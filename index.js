const cfgPhone = require("asterisk-cfgphonelib/cfgPhone");
const cfgPhoneNumber = require("asterisk-cfgphonelib/cfgPhoneNumber");

let test = new cfgPhone(
    {
                ntpserver : '10.56.10.251',
                sipserver : '10.56.10.251',
                phones : ['/etc/asterisk/myconf/sip_internals.conf']
            });
test.Run();