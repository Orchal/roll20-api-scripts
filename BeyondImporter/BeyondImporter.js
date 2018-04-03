/*
 * Version 0.1.7
 * Made By Robin Kuiper
 * Skype: RobinKuiper.eu
 * Discord: Atheos#1014
 * Roll20: https://app.roll20.net/users/1226016/robin-k
 * Roll20 Thread: https://app.roll20.net/forum/post/6248700/script-beta-beyondimporter-import-dndbeyond-character-sheets
 * Github: https://github.com/RobinKuiper/Roll20APIScripts
 * Reddit: https://www.reddit.com/user/robinkuiper/
*/

(function() {
    const _ABILITY = {
        'STR': 'strength',
        'DEX': 'dexterity',
        'CON': 'constitution',
        'INT': 'intelligence',
        'WIS': 'wisdom',
        'CHA': 'charisma'
    }

    const skills = [
        'acrobatics',
        'animal_handling',
        'arcana',
        'athletics',
        'deception',
        'history',
        'insight',
        'intimidation',
        'investigation',
        'medicine',
        'nature',
        'perception',
        'performance',
        'persuasion',
        'religion',
        'sleight_of_hand',
        'stealth',
        'survival'
    ]

    // Styling for the chat responses.
    const style = "overflow: hidden; background-color: #fff; border: 1px solid #000; padding: 5px; border-radius: 5px;";
    const buttonStyle = "background-color: #000; border: 1px solid #292929; border-radius: 3px; padding: 5px; color: #fff; text-align: center; float: right;"

    let jack = '0';

    on('ready',()=>{ 
        checkInstall();
        log('DNDBeyond Importer Ready!');
        if(state.BEYONDIMPORTER.config.debug){ sendChat('', 'DNDBeyond Importer Ready!'); }
    });

    on('chat:message', function(msg) {
        if (msg.type != 'api') return;

        // Split the message into command and argument(s)
        let args = msg.content.split(' ');
        let command = args.shift().substring(1);
        let extracommand = args.shift();

        if (command == 'beyond') {
            switch(extracommand){
                case 'help':
                    sendHelpMenu();
                break;

                case 'reset':
                    state.BEYONDIMPORTER = {};
                    setDefaults(true);
                    sendConfigMenu();
                break;

                case 'config':
                   if(args.length > 0){
                        let setting = args.shift().split('|');
                        let key = setting.shift();
                        let value = (setting[0] === 'true') ? true : (setting[0] === 'false') ? false : setting[0];

                        if(key === 'prefix' && value.charAt(0) !== '_'){ value = '_' + value}

                        state.BEYONDIMPORTER.config[key] = value;
                   }

                   sendConfigMenu();
                break;

                case 'import':
                    var json = msg.content.substring(14);
                    var character = JSON.parse(json).character;

                    // Remove characters with the same name if overwrite is enabled.
                    if(state.BEYONDIMPORTER.config.overwrite){
                        var objects = findObjs({                                                          
                            _type: "character",
                            name: character.name + state.BEYONDIMPORTER.config.prefix                     
                        }, {caseInsensitive: true});

                        for(var i = 0; i < objects.length; i++){
                            objects[i].remove();
                        }
                    }

                    // Create character object
                    var object = createObj("character", { name: character.name + state.BEYONDIMPORTER.config.prefix  });

                    // Make Speed String
                    let speed = character.weightSpeeds.normal.walk + 'ft.';
                    for(var key in character.weightSpeeds.normal){
                        if(key !== 'walk' && character.weightSpeeds.normal[key] !== 0){
                            speed += ', ' + key + ' ' + character.weightSpeeds.normal[key] + 'ft.';
                        }
                    }

                    // Import Character Inventory
                    if(state.BEYONDIMPORTER.config.imports.inventory){
                        const inventory = character.inventory;
                        for(var key in inventory){
                            inventory[key].forEach((item) => {
                                var row = getOrMakeRowID(object,"repeating_inventory_",item.definition.name);

                                let attributes = {}
                                attributes["repeating_inventory_"+row+"_itemname"] = item.definition.name;
                                attributes["repeating_inventory_"+row+"_equipped"] = (item.equipped) ? '1' : '0';
                                attributes["repeating_inventory_"+row+"_itemcount"] = item.quantity;
                                attributes["repeating_inventory_"+row+"_itemweight"] = item.definition.weight / item.definition.bundleSize;
                                attributes["repeating_inventory_"+row+"_itemcontent"] = replaceChars(item.definition.description);
                                let _itemmodifiers = 'Item Type: ' + item.definition.type;
                                if(item.definition.hasOwnProperty('armorClass')){
                                    _itemmodifiers += ', AC: ' + item.definition.armorClass;
                                }
                                if(item.definition.hasOwnProperty('damage')){
                                    let properties = '';
                                    let finesse = false;
                                    for(var j = 0; j < item.definition.properties.length; j++){
                                        properties += item.definition.properties[j].name + ', ';

                                        //if(item.definition.properties[j].name === 'Finesse'){ finesse = true }
                                    }
                                    attributes["repeating_inventory_"+row+"_itemproperties"] = properties;
                                    attributes["repeating_inventory_"+row+"_hasattack"] = '0';
                                    _itemmodifiers = 'Item Type: ' + item.definition.attackType + ' ' + item.definition.filterType + ', Damage: ' + item.definition.damage.diceString + ', Damage Type: ' + item.definition.damageType + ', Range: ' + item.definition.range + '/' + item.definition.longRange;

                                    // CREATE ATTACK
                                    let attack = {
                                        name: item.definition.name,
                                        range: item.definition.range + '/' + item.definition.longRange,
                                        attack: {
                                            attribute: (item.definition.statModifier.dex && getTotalAbilityScore(character, 'dexterity', 'dex') > getTotalAbilityScore(character, 'strength', 'str')) ? 'dexterity' : (item.definition.statModifier.str) ? 'strength' : 'dexterity'
                                        },
                                        damage: {
                                            diceString: item.definition.damage.diceString,
                                            type: item.definition.damageType,
                                            attribute: (item.definition.statModifier.dex && getTotalAbilityScore(character, 'dexterity', 'dex') > getTotalAbilityScore(character, 'strength', 'str')) ? 'dexterity' : (item.definition.statModifier.str) ? 'strength' : 'dexterity'
                                        },
                                        description: replaceChars(item.definition.description)
                                    }

                                    let attackid = createRepeatingAttack(object, attack);
                                    // /CREATE ATTACK
                                }
                                attributes["repeating_inventory_"+row+"_itemmodifiers"] = _itemmodifiers;
                                setAttrs(object.id, attributes);
                            });
                        }
                    }

                    // Languages
                    if(state.BEYONDIMPORTER.config.imports.languages){
                        let languages = getObjects(character, 'type', 'language');
                        languages.forEach((language) => {
                            var row = getOrMakeRowID(object,"repeating_proficiencies_",language.friendlySubtypeName);

                            let attributes = {}
                            attributes["repeating_proficiencies_"+row+"_name"] = language.friendlySubtypeName;
                            attributes["repeating_proficiencies_"+row+"_prof_type"] = 'LANGUAGE';
                            attributes["repeating_proficiencies_"+row+"_options-flag"] = '0';

                            setAttrs(object.id, attributes);
                        });
                    }

                    // Import Proficiencies
                    if(state.BEYONDIMPORTER.config.imports.proficiencies){
                        const weapons = ['Club', 'Dagger', 'Greatclub', 'Handaxe', 'Javelin', 'Light hammer', 'Mace', 'Quarterstaff', 'Sickle', 'Spear', 'Crossbow, Light', 'Dart', 'Shortbow', 'Sling', 'Battleaxe', 'Flail', 'Glaive', 'Greataxe', 'Greatsword', 'Halberd', 'Lance', 'Longsword', 'Maul', 'Morningstar', 'Pike', 'Rapier', 'Scimitar', 'Shortsword', 'Trident', 'War pick', 'Warhammer', 'Whip', 'Blowgun', 'Crossbow, Hand', 'Crossbow, Heavy', 'Longbow', 'Net'];
                        let proficiencies = getObjects(character, 'type', 'proficiency');
                        proficiencies.forEach((prof) => {
                            var row = getOrMakeRowID(object,"repeating_proficiencies_",prof.friendlySubtypeName);

                            let attributes = {}
                            attributes["repeating_proficiencies_"+row+"_name"] = prof.friendlySubtypeName;
                            attributes["repeating_proficiencies_"+row+"_prof_type"] = (prof.subType.includes('weapon') || weapons.includes(prof.friendlySubtypeName)) ? 'WEAPON' : (prof.subType.includes('armor') || prof.subType.includes('shield')) ? 'ARMOR' : 'OTHER';

                            let skill = prof.subType.replace('-', '_');
                            if(skills.includes(skill)){
                                attributes[skill + '_prof'] = '(@{pb}*@{'+skill+'_type})';
                            }

                            attributes["repeating_proficiencies_"+row+"_options-flag"] = '0';

                            setAttrs(object.id, attributes);
                        });
                    }

                    // Handle (Multi)Class Features
                    let multiclass_level = 0;
                    if(state.BEYONDIMPORTER.config.imports.classes){
                        character.classes.forEach((current_class) => {
                            if(!current_class.isStartingClass){
                                let multiclasses = {};
                                multiclasses['multiclass'+i+'_flag'] = '1';
                                multiclasses['multiclass'+i+'_lvl'] = current_class.level;
                                multiclasses['multiclass'+i] = current_class.class.name.toLowerCase();
                                setAttrs(object.id, multiclasses);

                                multiclass_level += current_class.level;
                            }

                            current_class.features.forEach(function(trait)
                            {
                                if(trait.definition.name.includes('Jack')){
                                    jack = '@{jack}';
                                }

                                let description = '';
                                trait.options.forEach((option) => {
                                    description += option.name + '\n';
                                    description += (option.description !== '') ? option.description + '\n\n' : '\n';
                                });

                                description += trait.definition.description;

                                let t = {
                                    name: trait.definition.name,
                                    description: replaceChars(description),
                                    source: 'Class',
                                    source_type: current_class.class.name
                                }

                                createRepeatingTrait(object, t);
                            });

                            // Class Spells
                            if(current_class.hasOwnProperty('spells')){
                                current_class.spells.forEach((spell) => {
                                    let level = (spell.definition.level === 0) ? 'cantrip' : spell.definition.level.toString();
                                    var row = getOrMakeRowID(object,"repeating_spell-"+level+"_",spell.definition.name);

                                    let attributes = {}
                                    attributes["repeating_spell-"+level+"_"+row+"_spellprepared"] = (spell.prepared || spell.alwaysPrepared) ? '1' : '0';
                                    attributes["repeating_spell-"+level+"_"+row+"_spellname"] = spell.definition.name;
                                    attributes["repeating_spell-"+level+"_"+row+"_spellschool"] = spell.definition.school.toLowerCase();
                                    attributes["repeating_spell-"+level+"_"+row+"_spellritual"] = (spell.ritual) ? '{{ritual=1}}' : '0';
                                    attributes["repeating_spell-"+level+"_"+row+"_spellcastingtime"] = spell.castingTime.castingTimeInterval + ' ' + spell.castingTime.castingTimeUnit;
                                    attributes["repeating_spell-"+level+"_"+row+"_spellrange"] = (spell.definition.range.origin === 'Ranged') ? spell.definition.range.rangeValue + 'ft.' : spell.definition.range.origin;
                                    attributes["repeating_spell-"+level+"_"+row+"_options-flag"] = '0';
                                    attributes["repeating_spell-"+level+"_"+row+"_spellritual"] = (spell.definition.ritual) ? '1' : '0';
                                    attributes["repeating_spell-"+level+"_"+row+"_spellconcentration"] = (spell.definition.concentration) ? '{{concentration=1}}' : '0';
                                    attributes["repeating_spell-"+level+"_"+row+"_spellduration"] = (spell.definition.duration.durationUnit !== null) ? spell.definition.duration.durationInterval + ' ' + spell.definition.duration.durationUnit : spell.definition.duration.durationType;

                                    let descriptions = spell.definition.description.split('At Higher Levels. ');
                                    attributes["repeating_spell-"+level+"_"+row+"_spelldescription"] = replaceChars(descriptions[0]);
                                    attributes["repeating_spell-"+level+"_"+row+"_spellathigherlevels"] = (descriptions.length > 1) ? replaceChars(descriptions[1]) : '';

                                    let components = spell.definition.components.split(', ');
                                    attributes["repeating_spell-"+level+"_"+row+"_spellcomp_v"] = (components.includes('V')) ? '{{v=1}}' : '0';
                                    attributes["repeating_spell-"+level+"_"+row+"_spellcomp_s"] = (components.includes('S')) ? '{{s=1}}' : '0';
                                    attributes["repeating_spell-"+level+"_"+row+"_spellcomp_m"] = (components.includes('M')) ? '{{m=1}}' : '0';
                                    attributes["repeating_spell-"+level+"_"+row+"_spellcomp_materials"] = (components.includes('M')) ? replaceChars(spell.definition.componentsDescription) : '';

                                    // Damage/Attack
                                    let damage = getObjects(spell, 'type', 'damage');
                                    if(damage.length !== 0){
                                        damage = damage[0];

                                        //attributes["repeating_spell-"+level+"_"+row+"_spelloutput"] = 'ATTACK';
                                        attributes["repeating_spell-"+level+"_"+row+"_spellattack"] = (spell.definition.range.origin === 'Ranged') ? 'Ranged' : 'Melee';
                                        attributes["repeating_spell-"+level+"_"+row+"_spelldamage"] = (damage.die.fixedValue !== null) ? damage.die.fixedValue : damage.die.diceString;
                                        attributes["repeating_spell-"+level+"_"+row+"_spelldamagetype"] = damage.friendlySubtypeName;

                                        // FOR SPELLS WITH MULTIPLE DAMAGE OUTPUTS
                                        //attributes["repeating_spell-"+level+"_"+row+"_spelldamage2"] = damage.die.diceString;
                                        //attributes["repeating_spell-"+level+"_"+row+"_spelldamagetype2"] = damage.friendlySubtypeName;

                                        // CREATE ATTACK
                                        let attack = {
                                            name: spell.definition.name,
                                            range: (spell.definition.range.origin === 'Ranged') ? spell.definition.range.rangeValue + 'ft.' : spell.definition.range.origin,
                                            attack: {
                                                attribute: _ABILITY[current_class.class.spellCastingAbility]
                                            },
                                            damage: {
                                                diceString: (damage.die.fixedValue !== null) ? damage.die.fixedValue : damage.die.diceString,
                                                type: damage.friendlySubtypeName,
                                                attribute: '0'
                                            },
                                            description: replaceChars(spell.definition.description)
                                        }

                                        let attackid = createRepeatingAttack(object, attack);
                                        attributes["repeating_spell-"+level+"_"+row+"_rollcontent"] = '%{'+object.id+'|repeating_attack_'+attackid+'_attack}';
                                        // /CREATE ATTACK

                                        if(damage.hasOwnProperty('atHigherLevels') && damage.atHigherLevels.scaleType === 'spellscale'){
                                            attributes["repeating_spell-"+level+"_"+row+"_spellhldie"] = '1';
                                            attributes["repeating_spell-"+level+"_"+row+"_spellhldietype"] = 'd'+damage.die.diceValue;
                                        }
                                    }

                                    setAttrs(object.id, attributes);
                                });
                            }
                        });
                    }

                    if(state.BEYONDIMPORTER.config.imports.traits){
                        // Race Features
                        character.features.racialTraits.forEach((trait) => {

                            let description = '';
                            trait.options.forEach((option) => {
                                description += option.name + '\n';
                                description += (option.description !== '') ? option.description + '\n\n' : '\n';
                            });

                            description += trait.definition.description;

                            let t = {
                                name: trait.definition.name,
                                description: replaceChars(description),
                                source: 'Race',
                                source_type: character.race
                            }

                            createRepeatingTrait(object, t);
                        });

                        // Feats
                        character.features.feats.forEach((feat) => {
                            let t = {
                                name: feat.definition.name,
                                description: replaceChars(feat.definition.description),
                                source: 'Feat',
                                source_type: feat.definition.name
                            }

                            createRepeatingTrait(object, t);
                        });

                        // Background Feature
                        if(character.features.background.definition && character.features.background.definition.featureName){
                            let btrait = {
                                name: character.features.background.definition.featureName,
                                description: replaceChars(character.features.background.definition.featureDescription),
                                source: 'Background',
                                source_type: character.features.background.definition.name
                            }

                            createRepeatingTrait(object, btrait);
                        }
                    }

                    let bonusses = getObjects(character, 'type', 'bonus');
                    let bonus_attributes = {}
                    if(state.BEYONDIMPORTER.config.imports.bonusses){
                        bonusses.forEach(function(bonus){
                            if(!bonus.id.includes('spell')){
                                switch(bonus.subType){
                                    case 'saving-throws':
                                        bonus_attributes['strength_save_mod'] = bonus.value;
                                        bonus_attributes['dexterity_save_mod'] = bonus.value;
                                        bonus_attributes['constitution_save_mod'] = bonus.value;
                                        bonus_attributes['intelligence_save_mod'] = bonus.value;
                                        bonus_attributes['wisdom_save_mod'] = bonus.value;
                                        bonus_attributes['charisma_save_mod'] = bonus.value;
                                    break;

                                    default:
                                        if(skills.includes(bonus.subType)){
                                            bonus_attributes[bonus.subType + '_flat'] = bonus.value;
                                        }
                                    break;
                                }
                            }
                        })
                    }

                    let contacts = '',
                    treasure = '',
                    otherNotes = '';
                    if(state.BEYONDIMPORTER.config.imports.notes){
                        contacts += (character.notes.allies) ? 'ALLIES:\n' + character.notes.allies + '\n\n' : '';
                        contacts += (character.notes.organizations) ? 'ORGANIZATIONS:\n' + character.notes.organizations + '\n\n' : '';
                        contacts += (character.notes.enemies) ? 'ENEMIES:\n' + character.notes.enemies : '';

                        treasure += (character.notes.personalPossessions) ? 'PERSONAL POSSESSIONS:\n' + character.notes.personalPossessions + '\n\n' : '';
                        treasure += (character.notes.otherHoldings) ? 'OTHER HOLDINGS:\n' + character.notes.otherHoldings : '';

                        otherNotes += (character.notes.otherNotes) ? 'OTHER NOTES:\n' + character.notes.otherNotes + '\n\n' : '';
                        otherNotes += (character.faith) ? 'FAITH: ' + character.faith + '\n' : '';
                        otherNotes += (character.lifestyle) ? 'Lifestyle: ' + character.lifestyle.name + ' with a ' + character.lifestyle.cost + ' cost.' : '';
                    }

                    let other_attributes = { 
                        // Base Info
                        'level': character.classes[0].level + multiclass_level,
                        'experience': character.experience.current,
                        'race': character.race,
                        'background': character.background,
                        'alignment': character.alignment,
                        'speed': speed,
                        'hp_temp': character.hitPoints.temp || '',
                        'inspiration': (character.inspiration) ? 'on' : 0,

                        // Bio Info
                        'age': character.age,
                        'size': character.size,
                        'height': character.height,
                        'weight': character.weight,
                        'eyes': character.eyes,
                        'hair': character.hair,
                        'skin': character.skin,
                        'character_appearance': character.traits.appearance,

                        // Ability Scores
                        'strength_base': getTotalAbilityScore(character, 'strength', 'str'),
                        'dexterity_base': getTotalAbilityScore(character, 'dexterity', 'dex'),
                        'constitution_base': getTotalAbilityScore(character, 'constitution', 'con'),
                        'intelligence_base': getTotalAbilityScore(character, 'intelligence', 'int'),
                        'wisdom_base': getTotalAbilityScore(character, 'wisdom', 'wis'),
                        'charisma_base': getTotalAbilityScore(character, 'charisma', 'cha'),

                        // Class(es)
                        'class': character.classes[0].class.name,
                        'base_level': character.classes[0].level,

                        // Traits
                        'personality_traits': character.traits.personalityTraits,
                        'options-flag-personality': '0',
                        'ideals': character.traits.ideals,
                        'options-flag-ideals': '0',
                        'bonds': character.traits.bonds,
                        'options-flag-bonds': '0',
                        'flaws': character.traits.flaws,
                        'options-flag-flaws': '0',

                        // currencies
                        'cp': character.currencies.cp,
                        'sp': character.currencies.sp,
                        'gp': character.currencies.gp,
                        'ep': character.currencies.ep,
                        'pp': character.currencies.pp,

                        // Notes/Bio
                        'character_backstory': character.notes.backstory,
                        'allies_and_organizations': contacts,
                        'additional_feature_and_traits': otherNotes,
                        'treasure': treasure,

                        jack_of_all_trades: jack
                    }

                    setAttrs(object.id, Object.assign(other_attributes, bonus_attributes)); 

                    let hp = Math.floor(character.hitPoints.max + (character.level * ((other_attributes.constitution_base-10)/2)));

                    createObj('attribute', {
                        characterid: object.id,
                        name: 'hp',
                        current: hp,
                        max: hp
                    });

                    sendChat('', '<div style="'+style+'">Import of <b>' + character.name + '</b> is ready.</div>');
                break;

                default:
                    sendHelpMenu();
                break;
            }
        }
    });

    const sendConfigMenu = (first) => {
        let prefix = (state.BEYONDIMPORTER.config.prefix !== '') ? state.BEYONDIMPORTER.config.prefix : '[NONE]';
        let prefixButton = makeButton(prefix, '!beyond config prefix|?{Prefix}', buttonStyle);
        let overwriteButton = makeButton(state.BEYONDIMPORTER.config.overwrite, '!beyond config overwrite|'+!state.BEYONDIMPORTER.config.overwrite, buttonStyle);

        let listItems = [
            '<span style="float: left">Overwrite:</span> '+overwriteButton,
            '<span style="float: left">Prefix:</span> '+prefixButton
        ]

        let list = makeList(listItems, 'overflow: hidden; list-style: none; padding: 0; margin: 0;', 'overflow: hidden');

        let resetButton = makeButton('Reset', '!beyond reset', buttonStyle + ' width: 100%');

        let title_text = (first) ? 'BeyondImporter First Time Setup' : 'BeyondImporter Config';
        let text = '<div style="'+style+'">'+makeTitle(title_text)+list+'<hr><p style="font-size: 80%">You can always come back to this config by typing `!beyond config`.</p><hr>'+resetButton+'</div>';

        sendChat('', '/w gm ' + text);
    }

    const sendHelpMenu = (first) => {
        let configButton = makeButton('Config', '!beyond config', buttonStyle+' width: 100%;');

        let listItems = [
            '<span style="text-decoration: underline">!beyond help</span> - Shows this menu.',
            '<span style="text-decoration: underline">!beyond config</span> - Shows the configuration menu.',
            '<span style="text-decoration: underline">!beyond import [CHARACTER JSON]</span> - Imports a character from <a href="http://www.dndbeyond.com" target="_blank">DNDBeyond</a>.',
        ]

        let command_list = makeList(listItems, 'list-style: none; padding: 0; margin: 0;')
        
        let text = '<div style="'+style+'">'+makeTitle('BeyondImporter Help')+'<p>Go to a character on <a href="http://www.dndbeyond.com" target="_blank">DNDBeyond</a>, and put `/json` behind the link. Copy the full contents of this page and paste it behind the command `!beyond import`.</p><p>For more information take a look at my <a style="text-decoration: underline" href="https://github.com/RobinKuiper/Roll20APIScripts" target="_blank">Github</a> repository.</p><hr><b>Commands:</b>'+command_list+'<hr>'+configButton+'</div>';

        sendChat('', '/w gm ' + text);
    }

    const makeTitle = (title) => {
        return '<h3 style="margin-bottom: 10px;">'+title+'</h3>';
    }

    const makeButton = (title, href, style) => {
        return '<a style="'+style+'" href="'+href+'">'+title+'</a>';
    }

    const makeList = (items, listStyle, itemStyle) => {
        let list = '<ul style="'+listStyle+'">';
        items.forEach((item) => {
            list += '<li style="'+itemStyle+'">'+item+'</li>';
        });
        list += '</ul>';
        return list;
    }

    const replaceChars = (text) => {
        return text.replace('&rsquo;', '\'').replace('&nbsp;', ' ')
    }

    const createRepeatingTrait = (object, trait) => {
        var row = getOrMakeRowID(object,"repeating_traits_",trait.name);

        let attributes = {}
        attributes["repeating_traits_"+row+"_name"] = trait.name;
        attributes["repeating_traits_"+row+"_source"] = trait.source;
        attributes["repeating_traits_"+row+"_source_type"] = trait.source_type;
        attributes["repeating_traits_"+row+"_description"] = replaceChars(trait.description);
        attributes["repeating_traits_"+row+"_options-flag"] = '0';
        //attributes["repeating_traits_"+row+"_display_flag"] = false;
        setAttrs(object.id, attributes);
    }

    const createRepeatingAttack = (object, attack) => {
        let attackrow = getOrMakeRowID(object,"repeating_attack_",attack.name);
        let attackattributes = {};
        attackattributes["repeating_attack_"+attackrow+"_options-flag"] = '0';
        attackattributes["repeating_attack_"+attackrow+"_atkname"] = attack.name;
        attackattributes["repeating_attack_"+attackrow+"_atkflag"] = '{{attack=1}}';
        attackattributes["repeating_attack_"+attackrow+"_atkattr_base"] = '@{'+attack.attack.attribute+'_mod}';
        attackattributes["repeating_attack_"+attackrow+"_atkprofflag"] = '(@{pb})';
        
        attackattributes["repeating_attack_"+attackrow+"_atkrange"] = attack.range;
        attackattributes["repeating_attack_"+attackrow+"_dmgflag"] = '{{damage=1}} {{dmg1flag=1}}';
        attackattributes["repeating_attack_"+attackrow+"_dmgbase"] = attack.damage.diceString;
        attackattributes["repeating_attack_"+attackrow+"_dmgattr"] = (attack.damage.attribute === '0') ? '0' : '@{'+attack.damage.attribute+'_mod}';
        attackattributes["repeating_attack_"+attackrow+"_dmgtype"] = attack.damage.type;
        attackattributes["repeating_attack_"+attackrow+"_dmgcustcrit"] = attack.damage.diceString;
        attackattributes["repeating_attack_"+attackrow+"_atk_desc"] = replaceChars(attack.description);
        setAttrs(object.id, attackattributes);

        return attackrow;
    }

    const getTotalAbilityScore = (character, score, score_short) => {
        let base = character.stats[score_short],
        bonus = character.bonusStats[score_short],
        override = character.overrideStats[score_short],
        total = base + bonus + override,
        modifiers = getObjects(character, '', score + "-score");
        
        if(modifiers.length > 0){
            for(var i = 0; i < modifiers.length; i++){
                total += modifiers[i].value;
            }
        }

        return total;
    }

    //return an array of objects according to key, value, or key and value matching
    const getObjects = (obj, key, val) => {
        var objects = [];
        for (var i in obj) {
            if (!obj.hasOwnProperty(i)) continue;
            if (typeof obj[i] == 'object') {
                objects = objects.concat(getObjects(obj[i], key, val));    
            } else 
            //if key matches and value matches or if key matches and value is not passed (eliminating the case where key matches but passed value does not)
            if (i == key && obj[i] == val || i == key && val == '') { //
                objects.push(obj);
            } else if (obj[i] == val && key == ''){
                //only add if the object is not already in the array
                if (objects.lastIndexOf(obj) == -1){
                    objects.push(obj);
                }
            }
        }
        return objects;
    }

    // Find an existing repeatable item with the same name, or generate new row ID
    const getOrMakeRowID = function(character,repeatPrefix,name){
        // Get list of all of the character's attributes
        var attrObjs = findObjs({ _type: "attribute", _characterid: character.get("_id") });
        
        var i = 0;
        while (i < attrObjs.length)
        {
            // If this is a feat taken multiple times, strip the number of times it was taken from the name
            var attrName = attrObjs[i].get("current").toString();
            if (regexIndexOf(attrName, / x[0-9]+$/) !== -1)
                attrName = attrName.replace(/ x[0-9]+/,"");

            if (attrObjs[i].get("name").indexOf(repeatPrefix) !== -1 && attrObjs[i].get("name").indexOf("_name") !== -1 && attrName === name)
                return attrObjs[i].get("name").substring(repeatPrefix.length,(attrObjs[i].get("name").indexOf("_name")));
            i++;
        }
        return generateRowID();
    }

    const generateUUID = (function() {
        var a = 0, b = [];
        return function() {
            var c = (new Date()).getTime() + 0, d = c === a;
            a = c;
            for (var e = new Array(8), f = 7; 0 <= f; f--) {
                e[f] = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(c % 64);
                c = Math.floor(c / 64);
            }
            c = e.join("");
            if (d) {
                for (f = 11; 0 <= f && 63 === b[f]; f--) {
                    b[f] = 0;
                }
                b[f]++;
            } else {
                for (f = 0; 12 > f; f++) {
                    b[f] = Math.floor(64 * Math.random());
                }
            }
            for (f = 0; 12 > f; f++){
                c += "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz".charAt(b[f]);
            }
            return c;
        };
    }())

    const generateRowID = () => {
        "use strict";
        return generateUUID().replace(/_/g, "Z");
    }

    const regexIndexOf = function(str, regex, startpos) {
        var indexOf = str.substring(startpos || 0).search(regex);
        return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
    }

    const pre_log = (message) => {
        log('---------------------------------------------------------------------------------------------');
        log(message);
        log('---------------------------------------------------------------------------------------------');
    }

    const checkInstall = () => {
        if(!_.has(state, 'BEYONDIMPORTER')){
            state.BEYONDIMPORTER = state.BEYONDIMPORTER || {};
        }
        setDefaults();
    }

    const setDefaults = (reset) => {
        const defaults = {
            overwrite: false,
            debug: false,
            prefix: '',
            imports: {
                inventory: true,
                proficiencies: true,
                traits: true,
                classes: true,
                notes: true,
                languages: true,
                bonusses: true
            }
        };

        if(!state.BEYONDIMPORTER.config){
            state.BEYONDIMPORTER.config = defaults;
        }else{
            if(!state.BEYONDIMPORTER.config.hasOwnProperty('overwrite')){
                state.BEYONDIMPORTER.config.overwrite = false;
            }
            if(!state.BEYONDIMPORTER.config.hasOwnProperty('debug')){
                state.BEYONDIMPORTER.config.debug = false;
            }
            if(!state.BEYONDIMPORTER.config.hasOwnProperty('prefix')){
                state.BEYONDIMPORTER.config.prefix = '';
            }
            if(!state.BEYONDIMPORTER.config.hasOwnProperty('imports')){
                state.BEYONDIMPORTER.config.imports = {
                    inventory: true,
                    proficiencies: true,
                    traits: true,
                    classes: true,
                    notes: true,
                    languages: true,
                    bonusses: true
                };
            }else{
                if(!state.BEYONDIMPORTER.config.imports.hasOwnProperty('inventory')){
                    state.BEYONDIMPORTER.config.imports.inventory = true;
                }
                if(!state.BEYONDIMPORTER.config.imports.hasOwnProperty('proficiencies')){
                    state.BEYONDIMPORTER.config.imports.proficiencies = true;
                }
                if(!state.BEYONDIMPORTER.config.imports.hasOwnProperty('traits')){
                    state.BEYONDIMPORTER.config.imports.traits = true;
                }
                if(!state.BEYONDIMPORTER.config.imports.hasOwnProperty('classes')){
                    state.BEYONDIMPORTER.config.imports.classes = true;
                }
                if(!state.BEYONDIMPORTER.config.imports.hasOwnProperty('notes')){
                    state.BEYONDIMPORTER.config.imports.notes = true;
                }
                if(!state.BEYONDIMPORTER.config.imports.hasOwnProperty('languages')){
                    state.BEYONDIMPORTER.config.imports.languages = true;
                }
                if(!state.BEYONDIMPORTER.config.imports.hasOwnProperty('bonusses')){
                    state.BEYONDIMPORTER.config.imports.bonusses = true;
                }
            }
            if(!state.BEYONDIMPORTER.config.hasOwnProperty('firsttime')){
                if(!reset){
                    sendConfigMenu(true);
                }
                state.BEYONDIMPORTER.config.firsttime = false;
            }
        }
    }
})();