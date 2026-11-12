export type Platform="twitch"|"youtube"|"tiktok";
export interface AlertConfig {
 audio_id:string;audio_start:number;audio_end:number;
 enabled:boolean;design:string;tone:string;sample_amount:string;sample_note:string;
 title:string;color:string;secondary_color:string;label_color:string;text_color:string;message_color:string;
 font_family:string;name_size:number;message_size:number;event_label:string;sample_name:string;message_template:string;
 duration:number;volume:number;muted:boolean;paused:boolean;sound:boolean;
}
export interface AlertEvent {kind:string;name:string;config:AlertConfig;defaults:AlertConfig}
export interface AlertStatus {settings:{twitch:AlertConfig;youtube:AlertConfig;tiktok:AlertConfig;coordinate_audio:boolean};events:Record<Platform,AlertEvent[]>;twitch_pending:number;youtube_pending:number;tiktok_pending:number;connected:boolean}
