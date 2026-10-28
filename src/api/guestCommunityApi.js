import {supabaseUrl} from '../supabaseClient';
import {sortCommunityPosts} from './communityFeedApi';

const endpoint=import.meta.env.DEV?'/guest-community-local':`${supabaseUrl}/functions/v1/guest-community`;
const key=id=>`guestCommunitySession:${id}`;
const messages={verification_failed:'이름 또는 비밀번호가 일치하지 않거나 신청이 확정되지 않았어요. 같은 이름과 휴대폰 뒤 4자리를 쓰는 신청자가 여러 명이면 운영자에게 문의해주세요.',
    try_later:'확인 시도가 많아 잠시 제한됐어요. 15분 뒤 다시 시도해주세요.',
    access_changed:'로그인 시간이 만료됐거나 참여 권한이 변경됐어요. 신청 상태를 확인한 뒤 다시 로그인해주세요.',
    invalid_request:'입력한 내용을 확인해주세요.',temporarily_unavailable:'지금 확인을 완료하지 못했어요. 잠시 후 다시 시도해주세요.'};
const request=async(path,body,token,extra={})=>{
    let response,result;
    try{
        response=await fetch(endpoint+'/'+path,{method:'POST',cache:'no-store',credentials:'omit',
            headers:{apikey:import.meta.env.VITE_SUPABASE_ANON_KEY,...(token?{'X-Community-Guest-Token':token}:{}),
                ...(extra.headers||{'Content-Type':'application/json'})},body:extra.body||JSON.stringify(body)});
        result=await response.json();
    }catch{throw new Error(messages.temporarily_unavailable);}
    if(!response.ok){const error=new Error(messages[result.error]||messages.temporarily_unavailable);error.code=result.error;throw error;}
    return result;
};
export const guestCommunityApi={
    async verify(channelId,identity){
        const result=await request('verify',{channelId,...identity});
        sessionStorage.setItem(key(channelId),result.token);
        return result;
    },
    async resume(channelId){
        const token=sessionStorage.getItem(key(channelId));if(!token)return null;
        try{return {...(await request('action',{channelId,action:'context'},token)).result,token};}
        catch{sessionStorage.removeItem(key(channelId));return null;}
    },
    clear(channelId){sessionStorage.removeItem(key(channelId));},
    async signOut(channelId,token){
        try{if(token)await request('action',{channelId,action:'logout'},token);}
        catch{/* Expired or cancelled guest sessions must still clear locally. */}
        finally{sessionStorage.removeItem(key(channelId));}
    },
    services(channelId,token){
        const invoke=async(action,payload={})=>(await request('action',{channelId,action,payload},token)).result;
        return {
            channels:{
                fetchChannel:async()=>(await invoke('context')).channel,
                fetchProgramChannel:async()=>(await invoke('context')).channel,
                fetchPosts:async()=>sortCommunityPosts(await invoke('posts')),
                fetchMentionCandidates:()=>invoke('candidates'),
                fetchChallengeAccess:async()=>(await invoke('context')).challenge_access===true,
                createPost:({content,imageUrls,missionId})=>invoke('create_post',{content,image_urls:imageUrls,mission_id:missionId}),
                editPost:(post,userId,content,missionId,imageUrls=null)=>invoke('edit_post',{id:post.id,content,mission_id:missionId,
                    ...(imageUrls===null?{}:{expected_urls:(post.media||[]).map(m=>m.media_url),next_urls:imageUrls})}),
            },
            social:{isChallengeHost:async()=>false,
                toggleReaction:(postId,userId,emoji)=>invoke('post_reaction',{id:postId,emoji}),
                createComment:(postId,userId,content)=>invoke('create_comment',{id:postId,content}),
                updateComment:(id,content)=>invoke('edit_comment',{id,content}),
                deleteComment:id=>invoke('delete_comment',{id}),deletePost:id=>invoke('delete_post',{id}),
            },
            comments:{toggleChannelComment:(id,userId,emoji)=>invoke('comment_reaction',{id,emoji})},
            missions:{fetchSubmissions:()=>invoke('submissions')},
            feed:{fetchReadAt:()=>invoke('read_at'),markRead:(id,userId,readAt)=>invoke('mark_read',{read_at:readAt})},
            // Every server action rechecks the token and current participation.
            hasSession:async()=>Boolean(token),
            uploadImage:file=>request('upload',null,token,{headers:{'Content-Type':file.type,'X-Community-Channel':channelId},body:file}),
            removeImages:paths=>request('cleanup',{channelId,paths},token),
        };
    },
};
