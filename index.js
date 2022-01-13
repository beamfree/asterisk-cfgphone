const fs = require("fs");
const hash = require('object-hash');
const MD5 = require("crypto-js/md5");
const path = require("path");
const sleep = require('system-sleep');

class cfgPhoneNumber {
    constructor(options){
        Object.assign(this,
            {
                number: 0,
                template: '',
                mac: '',
                callerid : '',
                fullname : '',
                secret : ''
            }
            , options || {});
        this._cache = hash(this);
    }
    get number() { return this._number; }
    get mac() { return this._mac; }
    get callerid() { return this._callerid; }
    get fullname() { return this._fullname; }
    get secret() { return this._secret; }
    get template() { return this._template; }
    get md5() { return this._cache; }

    set number(value) { this._number =  value; }
    set mac(value) { this._mac = value; }
    set callerid(value) { this._callerid = value; }
    set fullname(value) { this._fullname = value; }
    set secret(value) { this._secret = value;  }
    set template(value) { this._template = value; }
}

class cfgPhone{

    constructor(options){
        Object.assign(this,
            {
                sipserver : '',
                ntpserver : '',
                phones : [],
                tftp: '/srv/tftp/',
                templates : '/etc/bStudio/cfgphone/templates/'
            }
            , options);
    }

    cfExist(Phone) {
        let Files = fs.readdirSync('templates/');
        for (let File of Files) {
            if(path.extname(File) == ".tmp") {  if(File.includes(Phone.template)) {  return File; } }
        }
        return null;
    }

    cfProcExist(Phone) {
        let Files = fs.readdirSync('templates/');
        for (let File of Files) {
            if(path.extname(File) == ".proc") {  if(File.includes(Phone.template)) {  return File; } }
        }
        return null;
    }

    cfCheckMD5(Phone) {
        if (this.FileExist('versions/' +  Phone.mac + ".ver")) {
            let _PhoneMD5 = fs.readFileSync('versions/' + Phone.mac + '.ver', 'utf8');
            if (_PhoneMD5 ==  Phone.md5) { return false;}
        } else { fs.writeFileSync('versions/' + Phone.mac + '.ver', Phone.md5);  }
        return true;
    }

    cfCreate(Phone, ConfigFileName, ProcFileName) {
        let _Config = fs.readFileSync('templates/' + ConfigFileName, 'utf8');
        let _Proc = require("./templates/" + ProcFileName);

        for (let [key, value] of Object.entries(Phone)) {
            _Config = this.replaceAll(_Config, '{!'+ key.substring(1) + '}', _Proc(key.substring(1),value));
        }
        let CurrentDataTime = new Date();

        _Config = this.replaceAll(_Config, '{!version}', _Proc('version',
            CurrentDataTime.getFullYear() + '.'
        +   CurrentDataTime.getMonth() + '' + (CurrentDataTime.getDate() + 1) + '.'
        +   CurrentDataTime.getHours() + '' + CurrentDataTime.getMinutes() + '' + CurrentDataTime.getSeconds()));
        _Config = this.replaceAll(_Config, '{!ntpserver}', _Proc('ntpserver',this.ntpserver));
        _Config = this.replaceAll(_Config, '{!sipserver}', _Proc('sipserver',this.sipserver));

        fs.writeFileSync('versions/' + _Proc("{!mac}", Phone.mac)+ ".ver", Phone.md5);
        let _ConfigOutFileName = ConfigFileName.replace('[!' + Phone.template + ']', _Proc("{!mac}", Phone.mac));
        _ConfigOutFileName  = _ConfigOutFileName .replace('.tmp', '');
        fs.writeFileSync(this.tftp  + _ConfigOutFileName , _Config);
    }

   cfInit(Phone)
    {

        let _Phone  = new cfgPhoneNumber(Phone);
        let ConfigFileName = this.cfExist(_Phone);
        let ProcFileName = this.cfProcExist(_Phone);
        if(ConfigFileName != null && ProcFileName!= null) {
            if (this.cfCheckMD5(_Phone)) { this.cfCreate(_Phone,ConfigFileName,ProcFileName);  }
        }
    }

    escapeRegExp(string) { return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    replaceAll(str, find, replace) { return str.replace(new RegExp(this.escapeRegExp(find), 'g'), replace); }

    ParseAsteriskCFG() {
        let Start = [];
        this.phones.forEach(PhonesConfigFile => {
                let PhonesConfig = fs.readFileSync(PhonesConfigFile, 'utf8');
                let PhonesConfigMD5 = MD5(PhonesConfig).toString();
                let PhonesConfigFileMD5;
                let IsReadConfig = true;

                if(this.FileExist('md5/' + path.basename(PhonesConfigFile) + '.md5')) {
                    PhonesConfigFileMD5 = fs.readFileSync('md5/' + path.basename(PhonesConfigFile) + '.md5', 'utf8');
                    if( PhonesConfigFileMD5 == PhonesConfigMD5) { IsReadConfig = false; }
                } else { fs.writeFileSync('md5/' + path.basename(PhonesConfigFile) + '.md5', PhonesConfigMD5); }

                if(IsReadConfig) {
                    PhonesConfig.split(/\r?\n/).forEach(Line => {
                            let IsStart = /\[([0-9]+)\]\((.*)\)/.exec(Line);
                            if (IsStart != null) {
                                if (Object.keys(Start).length > 0) {
                                    this.cfInit(Start);
                                    Start = [];
                                }
                                Start['number'] = IsStart[1];
                                Start['template'] = IsStart[2];
                            } else {
                                let LineParse = Line.split('=');
                                if (LineParse.length > 1) {
                                    switch (LineParse[0].toLowerCase().trim()) {
                                        case ";mac":
                                            Start['mac'] = LineParse[1].trim();
                                            break;
                                        case ";template":
                                            Start['template'] = LineParse[1].trim();
                                            break;
                                        case "secret":
                                            Start['secret'] = LineParse[1].trim();
                                            break;
                                        case "fullname":
                                            Start['fullname'] = this.replaceAll(LineParse[1].trim(),'"','');
                                            break;
                                        case "callerid":
                                            Start['callerid'] = this.replaceAll(LineParse[1].trim(),'"','');
                                            break;
                                    }
                                }
                            }
                        }
                    );
                }
            }
        );
    }

    FileExist(file) {
        let flag = true;
        try{  fs.accessSync(file, fs.constants.F_OK); }catch(e){ flag = false; }
        return flag;
    }

    Run()  {
        while(true) {
            this.ParseAsteriskCFG();
            sleep(2000);
        }
    }
}

let test = new cfgPhone(
    {
                ntpserver : '10.56.10.251',
                sipserver : '10.56.10.251',
                tftp: '/srv/tftp/',
                phones : ['/etc/asterisk/myconf/sip_internals.conf']
            });
test.Run();