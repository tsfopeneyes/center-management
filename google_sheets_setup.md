# 구글 시트 연동 가이드 📊

이 문서는 SCI CENTER 데이터를 구글 시트로 자동 동기화하기 위한 설정 방법을 안내합니다.

## 1단계: 구글 시트 만들기
1. 새로운 [구글 스프레드시트](https://sheets.new)를 생성합니다.
2. 시트의 이름을 자유롭게 정합니다 (예: "SCI_CENTER_데이터베이스").

## 2단계: 앱스 스크립트(Apps Script) 설정
1. 시트 상단 메뉴에서 **확장 프로그램** > **Apps Script**를 클릭합니다.
2. 기존에 있는 `Code.gs`의 내용을 모두 지우고 아래 코드를 복사하여 붙여넣습니다.

```javascript
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    
    // 벌크 데이터인 경우 처리 (여러 탭 동시 업데이트)
    var payloads = data.isBulk ? data.payloads : [data];
    
    payloads.forEach(function(p) {
      var tabName = p.tabName;
      var rows = p.rows;
      var headers = p.headers;

      var sheet = ss.getSheetByName(tabName);
      
      // 탭이 없으면 새로 생성
      if (!sheet) {
        sheet = ss.insertSheet(tabName);
        if (headers && headers.length > 0) {
          sheet.appendRow(headers);
        }
      }

      // 데이터 업데이트 (기존 내용을 지우고 최신 상태로 덮어쓰기)
      if (rows && rows.length > 0) {
        var dataToAppend = [];
        rows.forEach(function(row) {
          var rowData = [];
          headers.forEach(function(h) {
            rowData.push(row[h] || ""); 
          });
          dataToAppend.push(rowData);
        });

        // 시트 초기화 후 헤더와 데이터 다시 쓰기
        sheet.clear();
        if (headers && headers.length > 0) {
          sheet.appendRow(headers);
          sheet.getRange(2, 1, dataToAppend.length, headers.length).setValues(dataToAppend);
        }
      }
    });

    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}
```

## 3단계: 웹 앱 배포
1. Apps Script 화면 상단의 **배포** > **새 배포**를 누릅니다.
2. 유형 선택에서 **웹 앱**을 선택합니다.
3. 설정을 다음과 같이 변경합니다:
   - **설명**: "SCI Center Webhook"
   - **웹 앱을 실행할 사용자**: 나 (본인 계정)
   - **엑세스할 수 있는 사용자**: 모든 사용자 (Anyone)
4. **배포** 버튼을 누릅니다. (권한 승인 팝업이 뜨면 승인해 주세요)
5. 배포가 완료되면 생성된 **웹 앱 URL**을 복사합니다.

## 4단계: 서비스 연동
1. SCI CENTER 관리자 페이지의 **설정** > **외부 서비스 연동** 섹션으로 이동합니다.
2. 복사한 URL을 **Apps Script Webhook URL** 칸에 입력합니다.
3. **설정 저장**을 누른 후, **모든 데이터 시트 동기화** 버튼을 클릭하여 테스트해 보세요!

---
> [!TIP]
> **데이터 덮어쓰기 안내**
> 위 코드는 기본적으로 데이터를 '추가(Append)'합니다. 만약 "동기화 버튼을 누를 때마다 전체 데이터를 최신으로 교체"하고 싶으시다면, 코드 중간의 `sheet.clear();` 부분의 주석을 해제해 주세요.
