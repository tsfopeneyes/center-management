-- School addresses: unique or user-confirmed official NEIS schoolInfo matches, geocoded by NAVER Maps.
-- Sources and before-state retained in backups/school-map-addresses/.
-- Only 3 map columns are changed; names, regions, users and logs are preserved.
-- Recovery: retain before.json; restore only these 3 columns by UUID after impact review.
BEGIN;
DO $$
DECLARE changed integer;
BEGIN
    WITH updated AS (
      UPDATE public.schools AS s
      SET map_address=p.address, map_latitude=p.lat, map_longitude=p.lng
      FROM (VALUES
        ('f2ae2e3d-942e-4cf2-b3b5-3568fedaff9f'::uuid, '강명중학교 ', '서울특별시 강동구 상일로12길 56 강명중학교', 37.5556108::double precision, 127.1746091::double precision),
        ('91d0a9b6-3672-496e-ab55-d2f97bc54444'::uuid, '경기여자고등학교', '서울특별시 강남구 삼성로 29 경기여자고등학교', 37.4867642::double precision, 127.0657027::double precision),
        ('015b12e2-be21-454a-9783-b7ec0c982501'::uuid, '경민IT고등학교', '경기도 의정부시 서부로 545', 37.7458828::double precision, 127.0226192::double precision),
        ('01eb6a62-a8c8-4593-b6f1-48383a321d6e'::uuid, '고촌중학교', '경기도 김포시 고촌읍 신곡로 106 고촌중학교', 37.6085677::double precision, 126.7681199::double precision),
        ('70314694-9dd7-4443-9947-86c02eb04f74'::uuid, '과천여고', '경기도 과천시 희망길 36 과천여자고등학교, 과천외국어고등학교', 37.4325786::double precision, 126.9880866::double precision),
        ('faede71f-b226-47a1-9fcb-219ed1f8fb61'::uuid, '김포고등학교', '경기도 김포시 봉화로 37-15 김포고등학교, 김포여자중학교', 37.6191388::double precision, 126.7124797::double precision),
        ('da3c28c7-5004-4dfc-a437-3c1ea70e50bd'::uuid, '덕계고등학교', '경기도 양주시 평화로1489번길 34 덕계고등학교', 37.8242892::double precision, 127.0479341::double precision),
        ('fde9bde6-0499-473d-bb19-eea57816d88e'::uuid, '덕수고등학교', '서울특별시 송파구 위례북로 10 덕수고등학교', 37.4855945::double precision, 127.1470391::double precision),
        ('6015b2a1-453d-44c6-ace3-8b06221a247a'::uuid, '동북고등학교', '서울특별시 강동구 강동대로 305 동북중고등학교', 37.520389::double precision, 127.1404957::double precision),
        ('9d31f287-e976-4727-b95d-e641f41f0e25'::uuid, '미래산업과학고등학교', '서울특별시 노원구 덕릉로82길 54 미래산업과학고등학교', 37.6592182::double precision, 127.0792969::double precision),
        ('0b6dba99-454e-45d4-9a4d-6cb5121f7ce0'::uuid, '미림마이스터고', '서울특별시 관악구 호암로 546 서울미림여자고등학교', 37.4664314::double precision, 126.9327286::double precision),
        ('e78f5f47-3083-4eab-a38d-fb6fa266cc27'::uuid, '미사중학교', '경기도 하남시 미사강변한강로334번길 70 미사중학교', 37.558571::double precision, 127.1996957::double precision),
        ('40c7a4ee-1d5c-4a97-b29d-d5bd60f6e474'::uuid, '배명중학교', '서울특별시 송파구 삼학사로 11 배명중고등학교', 37.4988176::double precision, 127.0957019::double precision),
        ('e4e9a018-a65f-480c-86f6-10af455f7749'::uuid, '배재고등학교', '서울특별시 강동구 고덕로 227 배재고등학교', 37.5561082::double precision, 127.15085::double precision),
        ('b4b054a8-a099-4161-b5f4-f4407eb5c9bd'::uuid, '배화여자고등학교', '서울특별시 종로구 필운대로1길 34 배화여자대학교,배화여자중,고등학교', 37.5791763::double precision, 126.9658922::double precision),
        ('3d7a7473-11a9-40f8-8567-0f17dcddecd2'::uuid, '백현중학교', '경기도 성남시 분당구 황새울로 124 백현중학교', 37.3712621::double precision, 127.110514::double precision),
        ('920c7e4b-9746-4ade-b377-bb42b847ea0c'::uuid, '사우고등학교', '경기도 김포시 김포대로 824 사우고등학교', 37.6191687::double precision, 126.723533::double precision),
        ('15fb25b4-864f-40fd-aee3-9f46fdafde29'::uuid, '삼각산고등학교', '서울특별시 강북구 삼양로19길 40 삼각산고등학교', 37.6159663::double precision, 127.0201832::double precision),
        ('f5126080-2e65-4760-a3b2-be76fe0f4de2'::uuid, '서울공업고등학교', '서울특별시 동작구 대방동1길 46 서울공업고등학교', 37.5016013::double precision, 126.9222662::double precision),
        ('1bb39132-2dc1-41cc-a2c2-2c4e816d93e7'::uuid, '서울컨벤션고등학교', '서울특별시 강동구 동남로 964 서울컨벤션고등학교', 37.5592908::double precision, 127.1582042::double precision),
        ('1a309be9-a272-44ae-892c-dc82ac44b95a'::uuid, '서초문화예술정보학교', '서울특별시 서초구 남부순환로347길 69', 37.4875442::double precision, 127.0293037::double precision),
        ('38f2de59-2a2c-4699-b8c0-2e2746d7dcdd'::uuid, '석관고등학교', '서울특별시 성북구 한천로70길 30 석관고등학교', 37.6098317::double precision, 127.0665491::double precision),
        ('422aa01e-99d9-4d86-9d18-a1f14fa013ec'::uuid, '선사고등학교', '서울특별시 강동구 고덕로25길 17 선사고등학교', 37.5563623::double precision, 127.1358523::double precision),
        ('c629686a-6422-499c-a7d7-6daa49a1e433'::uuid, '선유고등학교', '서울특별시 영등포구 선유로 227 선유고등학교', 37.5339093::double precision, 126.8948979::double precision),
        ('fd6ff9de-af34-4fc4-84cc-b4203744eccc'::uuid, '성덕여자중학교', '서울특별시 강동구 구천면로 396 성덕고등학교,성덕여자중학교', 37.5496403::double precision, 127.141531::double precision),
        ('5bd51efb-5665-4a27-83c0-f62a75136b1b'::uuid, '성동고등학교', '서울특별시 중구 퇴계로90길 17 성동고등학교', 37.5642224::double precision, 127.0226728::double precision),
        ('cf1dc9d9-503c-447b-9a86-0ba679314ff3'::uuid, '성심여자고등학교', '서울특별시 용산구 원효로19길 49', 37.5343665::double precision, 126.9537281::double precision),
        ('98ec4639-08c0-4dc4-9def-dc5725ee6bd1'::uuid, '세현고등학교', '서울특별시 강서구 허준로 227 세현고등학교', 37.5604307::double precision, 126.8636212::double precision),
        ('b9e50e17-3afc-4835-a446-752a712dcd2e'::uuid, '숭의여자고등학교', '서울특별시 동작구 여의대방로36길 79 숭의여자중고등학교', 37.5078815::double precision, 126.9288774::double precision),
        ('bb565ad3-bc6d-4c21-9d9f-4b94b3046f07'::uuid, '양재고등학교', '서울특별시 서초구 남부순환로346길 9 양재고등학교', 37.4828934::double precision, 127.0326429::double precision),
        ('48433198-a897-441a-be1f-7e39e15ace04'::uuid, '여의도고등학교', '서울특별시 영등포구 국제금융로7길 37 여의도고등학교', 37.5252698::double precision, 126.9339718::double precision),
        ('e1317449-8379-4cb2-9ee3-f622112748e4'::uuid, '여의도여자고등학교', '서울특별시 영등포구 국제금융로7가길 13 여의도여자고등학교', 37.5229389::double precision, 126.9348125::double precision),
        ('142f2823-032d-4892-b9de-5d539707d8ad'::uuid, '영등포고등학교', '서울특별시 동작구 등용로8길 5-13 영등포고등학교', 37.5084935::double precision, 126.934045::double precision),
        ('b7ec5840-b122-4b73-b86f-b43b93eb3eb2'::uuid, '영등포여자고등학교', '서울특별시 영등포구 영등포로62길 13 영등포여자고등학교', 37.5153884::double precision, 126.9153564::double precision),
        ('902961a6-33b5-4668-94cc-ce6250f7bb8d'::uuid, '영락의료과학고등학교', '서울특별시 관악구 청룡16길 25 영락고등학교, 영락의료과학고등학교', 37.4766162::double precision, 126.9448716::double precision),
        ('52fed8be-9aa7-45ef-9d25-c8ec5c33f2cf'::uuid, '영훈고등학교', '서울특별시 강북구 도봉로13가길 19 영훈학교', 37.6132141::double precision, 127.0277903::double precision),
        ('8e1f4e57-007e-4711-92e1-3590acdb9757'::uuid, '용산고등학교', '서울특별시 용산구 두텁바위로 60 용산고등학교', 37.5456572::double precision, 126.9798077::double precision),
        ('e04ae57c-2862-4a44-af96-ddb25ca81091'::uuid, '용산철도고등학교', '서울특별시 용산구 서빙고로 24 용산철도고등학교', 37.5241878::double precision, 126.9668928::double precision),
        ('c113e0ec-932a-4205-9c06-f59d116ddcbd'::uuid, '운중고등학교', '경기도 성남시 분당구 운중로 95 운중고등학교', 37.3927542::double precision, 127.0737293::double precision),
        ('78ceb6b3-e2b9-4d5e-b31b-df91c6432852'::uuid, '인성여자고등학교', '인천광역시 제물포구 홍예문로 39 인성여자고등학교', 37.4733835::double precision, 126.6248353::double precision),
        ('c1a62b00-fc69-4794-b372-55cb39dc20b8'::uuid, '장충고등학교', '서울특별시 중구 동호로15길 93 장충중고등학교', 37.5531696::double precision, 127.0062047::double precision),
        ('a361f5bc-e219-44f7-b59a-f0654a16c763'::uuid, '재현고등학교', '서울특별시 노원구 덕릉로82길 64 재현학원', 37.6613333::double precision, 127.0809185::double precision),
        ('f5a06dc6-aa2e-4f46-95fe-6b66bb7cd58d'::uuid, '중경고등학교', '서울특별시 용산구 이촌로84길 34 중경고등학교', 37.5179195::double precision, 126.9753344::double precision),
        ('efd5a255-1c1d-4d76-a146-9115c04bff6d'::uuid, '한국모빌리티고등학교', '경기도 의정부시 가능로 57 한국모빌리티고등학교', 37.7479667::double precision, 127.0382739::double precision),
        ('d1954990-3154-4fef-a35d-fa80d64b8b78'::uuid, '한영외국어고등학교', '서울특별시 강동구 동남로 832 한영중.고등학교', 37.5482439::double precision, 127.1574458::double precision),
        ('1cce727f-be05-4f27-af28-e9af021db487'::uuid, '해성국제컨벤션고', '서울특별시 동대문구 전농로20길 31', 37.5817844::double precision, 127.0572757::double precision),
        ('61ec45c0-110b-4532-851c-fb1863d512a5'::uuid, '환일고등학교', '서울특별시 중구 환일길 47 환일중고등학교', 37.553758::double precision, 126.9625889::double precision),
        ('b0702e6c-ff2e-41b6-ba79-ad92af8438de'::uuid, '흑석고등학교', '서울특별시 동작구 흑석한강로 36 흑석고등학교', 37.5038::double precision, 126.9641232::double precision),
        ('307c4222-842f-4962-86a5-dbd57ad39b48'::uuid, '강남중학교', '서울특별시 동작구 대방동15길 29 강남중학교', 37.5027706::double precision, 126.9224878::double precision),
        ('7de722f2-1e37-4e43-bc3a-a61dfe0d00c4'::uuid, '강동고등학교', '서울특별시 강동구 구천면로 572 강동고등학교', 37.5499406::double precision, 127.1606417::double precision),
        ('7463ed7e-b262-4577-a19e-1574acf50667'::uuid, '광문고등학교', '서울특별시 강동구 동남로 968 광문고등학교', 37.5603898::double precision, 127.1578933::double precision),
        ('c492d94a-f48b-405d-b446-a1bec0b40f8c'::uuid, '대성고등학교', '서울특별시 은평구 갈현로29길 51-24 대성중학교, 대성고등학교', 37.6224195::double precision, 126.9094016::double precision),
        ('34cb23d4-1e34-46d8-9198-24061cc51efd'::uuid, '대원고등학교', '서울특별시 광진구 용마산로22길 26 대원학원', 37.5633128::double precision, 127.0895521::double precision),
        ('f3e7e3b9-cfeb-4c59-8733-2bfc43318522'::uuid, '동원중학교', '서울특별시 중랑구 양원역로 32 동원중학교', 37.6038248::double precision, 127.1089077::double precision),
        ('e503d2e4-0e44-43c3-93c6-ba4067f5893e'::uuid, '상일중학교', '서울특별시 강동구 천호대로219길 61 상일여자중고등학교', 37.5492333::double precision, 127.1696813::double precision),
        ('e2966c74-971a-4439-8646-df872ba79203'::uuid, '성남고등학교', '서울특별시 동작구 대방동길 74 성남고등학교, 성남중학교', 37.5051675::double precision, 126.9263282::double precision),
        ('7bc40cd3-055a-4df7-ac42-8474ae1bcd32'::uuid, '성덕고등학교', '서울특별시 강동구 구천면로 396 성덕고등학교,성덕여자중학교', 37.5496403::double precision, 127.141531::double precision),
        ('25c05085-55f2-44c8-87cd-970bebb03156'::uuid, '영신고등학교', '서울특별시 영등포구 대방천로14길 18 영신고등학교', 37.4979599::double precision, 126.9095051::double precision),
        ('ad1faa41-9408-4e11-9039-4d58323ac6db'::uuid, '한영고등학교', '서울특별시 강동구 동남로 832 한영중.고등학교', 37.5482439::double precision, 127.1574458::double precision),
        ('23e98c30-3f6b-4fd9-813d-5ea03b5efe35'::uuid, '부천상동고', '경기도 부천시 원미구 상이로 22 상동고등학교', 37.4910179::double precision, 126.7450352::double precision),
        ('5bbd19d7-a7c2-41cc-b3c5-b5c1581bd051'::uuid, '신릉중학교', '경기도 용인시 기흥구 새천년로 57 용인신릉중학교', 37.2900228::double precision, 127.115696::double precision)
      ) AS p(id,name,address,lat,lng)
      WHERE s.id=p.id AND s.name=p.name
        AND s.map_address IS NULL AND s.map_latitude IS NULL AND s.map_longitude IS NULL
      RETURNING s.id
    ) SELECT count(*) INTO changed FROM updated;
    IF changed <> 61 THEN
      RAISE EXCEPTION 'Expected 61 untouched schools, found %. Roll back and review concurrent changes.', changed;
    END IF;
END $$;
COMMIT;
