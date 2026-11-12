//! Conversión sin red de eventos oficiales. Nunca inventa un suscriptor a partir del contador.
use serde_json::Value;
#[derive(Debug,PartialEq)]
pub struct Incoming{pub kind:&'static str,pub name:String,pub amount:String,pub note:String}
fn text(v:&Value,k:&str)->String{v[k].as_str().unwrap_or("").into()}
pub fn twitch(kind:&str,e:&Value)->Option<Incoming>{
    let name=if e["is_anonymous"]==true{"Anónimo".into()}else{text(e,"user_name")};
    let (kind,amount,note)=match kind{
        "channel.follow"=>("follow","1".into(),String::new()),
        "channel.subscribe" if e["is_gift"]!=true=>("subscribe","1".into(),String::new()),
        "channel.subscription.message"=>("resub",e["cumulative_months"].to_string(),text(&e["message"],"text")),
        "channel.subscription.gift"=>("gift_subs",e["total"].to_string(),String::new()),
        "channel.cheer"=>("bits",e["bits"].to_string(),text(e,"message")),
        "channel.raid"=>return Some(Incoming{kind:"raid",name:text(e,"from_broadcaster_user_name"),amount:e["viewers"].to_string(),note:String::new()}),
        _=>return None,
    };Some(Incoming{kind,name,amount,note})
}
pub fn youtube(e:&Value)->Option<Incoming>{
    let s=&e["snippet"];let name=text(&e["authorDetails"],"displayName");
    let (kind,amount,note)=match s["type"].as_str()?{
        "newSponsorEvent"=>("member","1".into(),text(&s["newSponsorDetails"],"memberLevelName")),
        "memberMilestoneChatEvent"=>("member",s["memberMilestoneChatDetails"]["memberMonth"].to_string(),text(&s["memberMilestoneChatDetails"],"userComment")),
        "membershipGiftingEvent"=>("gift_members",s["membershipGiftingDetails"]["giftMembershipsCount"].to_string(),String::new()),
        "superChatEvent"=>("super_chat",text(&s["superChatDetails"],"amountDisplayString"),text(&s["superChatDetails"],"userComment")),
        "superStickerEvent"=>("super_sticker",text(&s["superStickerDetails"],"amountDisplayString"),text(&s["superStickerDetails"]["superStickerMetadata"],"altText")),
        _=>return None,
    };Some(Incoming{kind,name,amount,note})
}
#[cfg(test)]mod tests{use super::*;use serde_json::json;
#[test]fn gifts_do_not_double_alert(){assert!(twitch("channel.subscribe",&json!({"is_gift":true})).is_none());assert_eq!(twitch("channel.subscription.gift",&json!({"total":5,"is_anonymous":true})).unwrap().name,"Anónimo");}
#[test]fn actual_chat_events_only(){assert!(youtube(&json!({"snippet":{"type":"textMessageEvent"}})).is_none());let v=json!({"snippet":{"type":"superChatEvent","superChatDetails":{"amountDisplayString":"5 €","userComment":"<b>hola</b>"}},"authorDetails":{"displayName":"Luna"}});let a=youtube(&v).unwrap();assert_eq!(a.kind,"super_chat");assert_eq!(a.note,"<b>hola</b>");}
}
