import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkAndFix() {
    try {
        const { data: contents, error } = await supabase
            .from('contents')
            .select('*, schools(name, region)');
        
        if (error) throw error;
        
        console.log(`총 ${contents.length}개의 콘텐츠를 불러왔습니다.`);
        
        let targetCount = 0;
        for (const item of contents) {
            const isGangseo = item.schools?.region === '강서';
            if (isGangseo) {
                let currentLoc = '';
                let currentDesc = '';
                try {
                    if (item.description && item.description.startsWith('{')) {
                        const parsed = JSON.parse(item.description);
                        currentLoc = parsed.location || '';
                        currentDesc = parsed.desc || '';
                    } else {
                        currentDesc = item.description || '';
                    }
                } catch (e) {
                    currentDesc = item.description || '';
                }

                // 강서(이높플레이스)인데 위치가 '이높플레이스'가 아닌 경우
                if (currentLoc !== '이높플레이스') {
                    console.log(`[대상 발견] ID: ${item.id}, 이름: ${item.name}, 현재 위치: ${currentLoc}, 목적지: 이높플레이스`);
                    targetCount++;
                    
                    const newDescObj = {
                        location: '이높플레이스',
                        desc: currentDesc
                    };
                    
                    const { error: updateError } = await supabase
                        .from('contents')
                        .update({ description: JSON.stringify(newDescObj) })
                        .eq('id', item.id);
                        
                    if (updateError) {
                        console.error(`ID ${item.id} 업데이트 실패:`, updateError);
                    } else {
                        console.log(`ID ${item.id} 업데이트 완료!`);
                    }
                }
            }
        }
        
        console.log(`보정 필요한 대상 개수: ${targetCount}개 작업 완료.`);
    } catch (e) {
        console.error(e);
    }
}

checkAndFix();
