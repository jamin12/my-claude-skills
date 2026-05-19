---
name: rest-controller
description: REST 컨트롤러 규칙(InPort 호출, Request/Response DTO 분리, 매퍼 패턴). REST API 컨트롤러 작성/수정 시 참조한다.
---

# REST 컨트롤러 규칙

## 규칙 1: 위치
REST 컨트롤러는 `adapter/{도메인}/restIn/controller/` 패키지에 위치한다.

## 규칙 2: InPort를 통해 UseCase 호출
Controller는 InPort 인터페이스 타입을 주입받아 사용한다.

// WRONG - UseCase 구현체 직접 의존
```kotlin
@RestController
class AlertController(
    private val createAlertUseCase: CreateAlertUseCase,  // 구현체 타입
)
```

// CORRECT - InPort 인터페이스 의존
```kotlin
@RestController
class AlertController(
    private val createAlertInPort: CreateAlertInPort,  // 인터페이스 타입
)
```

## 규칙 3: Request/Response DTO 분리
Controller의 Request/Response DTO는 `adapter/{도메인}/restIn/dto/` 패키지에 위치.
Application 레이어의 Command/Result와는 별도로 정의하고 매퍼로 변환.

**DTO 파일 분리 규칙** (UseCase 의 Command/Result/Query 와 동일한 컨벤션):

역할별 파일에 관련 클래스를 모아서 작성한다. 클래스마다 개별 파일을 만들지 않는다.

```
adapter/{도메인}/restIn/dto/
├── Request.kt    # 모든 Request data class
└── Response.kt   # 모든 Response data class
```

- 해당 역할의 DTO 가 없으면 파일을 만들지 않는다
- 모든 DTO 는 `data class`
- ktlint `filename` 룰은 `.editorconfig` 에서 disabled 처리해 이 컨벤션과 충돌하지 않게 한다

// WRONG - Application DTO를 Controller에서 직접 사용, 반환도 raw DTO
```kotlin
@PostMapping("/alerts")
fun createAlert(@RequestBody command: CreateAlertCommand): CreateAlertResult {
    return createAlertInPort.execute(command)
}
```

// CORRECT - Adapter DTO로 변환 + CommonResponse 래핑 + ResponseEntity 반환
```kotlin
@PostMapping("/alerts")
fun createAlert(
    @RequestBody request: CreateAlertRequest,
): ResponseEntity<CommonResponse<CreateAlertResponse?>> {
    val result = createAlertInPort.execute(request.toCommand())
    return ResponseEntity.ok(CommonResponse.ok(CreateAlertResponse.from(result)))
}
```

## 규칙 5: 반환 타입은 항상 `ResponseEntity<CommonResponse<T?>>`

Controller 메서드의 반환 타입은 **항상 `ResponseEntity<CommonResponse<T?>>`** 로 통일한다.

이유:
- HTTP 상태 코드, 응답 헤더(예: `Location`)를 컨트롤러에서 명시적으로 제어할 수 있다
- 전역 응답 포맷(`CommonResponse`) 과 HTTP 메타가 같은 자리에서 표현되어 코드 흐름이 일관된다
- 예외 핸들러(`GlobalExceptionHandler`) 가 반환하는 타입과 시그니처가 같아 클라이언트 입장에서 응답 구조가 통일된다

```kotlin
@PostMapping
fun create(...): ResponseEntity<CommonResponse<AlertResponse?>> =
    ResponseEntity.ok(CommonResponse.ok(...))

@PostMapping
fun createWithLocation(...): ResponseEntity<CommonResponse<AlertResponse?>> =
    ResponseEntity
        .created(URI.create("/api/v1/alerts/${result.id}"))
        .body(CommonResponse.ok(...))

@DeleteMapping("/{id}")
fun delete(...): ResponseEntity<CommonResponse<Unit?>> {
    deleteAlertInPort.execute(id)
    return ResponseEntity.ok(CommonResponse.ok())
}
```

## 규칙 4: Mapper — MapStruct 기본, 확장함수 허용
REST 매퍼 파일(`adapter/{도메인}/restIn/mapper/`)에서는 변환 유형에 따라 패턴을 선택한다.

- **Request → Command**: MapStruct 인터페이스만 사용
- **Result → Response (단순 1:1 매핑)**: MapStruct 인터페이스 사용
- **Result → Response (필드 조합/가공 필요)**: 확장함수 사용

```kotlin
// MapStruct — 단순 1:1 매핑
@Mapper(componentModel = "spring")
interface AlertRestMapper {
    fun toCommand(request: CreateAlertRequest): CreateAlertCommand
    fun toResponse(result: AlertResult): AlertResponse
}

// 확장함수 — 필드 조합/가공이 필요한 경우
fun CreateAlertResult.toCreateResponse(): CreateAlertResponse =
    CreateAlertResponse(
        id = id.value,
        name = name,
        detail = activated?.let { AlertDetail(activated = it, threshold = threshold) },
    )
```

다중 파라미터 매핑 시 `@Mapping`으로 소스를 명시:

```kotlin
@Mapper(componentModel = "spring")
interface DepartmentRestMapper {
    @Mapping(source = "id", target = "id")
    fun toUpdateCommand(id: Long, request: UpdateDepartmentRequest): UpdateDepartmentCommand
}
```

## 체크리스트
- [ ] Controller가 adapter/{도메인}/restIn/controller/에 있는가?
- [ ] InPort 인터페이스를 통해 호출하는가?
- [ ] Request/Response DTO가 adapter 레이어에 있는가?
- [ ] Request→Command 변환에 MapStruct를 사용하는가?
- [ ] Result→Response 변환이 단순 1:1이면 MapStruct, 필드 조합/가공이면 확장함수를 사용하는가?
- [ ] 반환 타입이 `ResponseEntity<CommonResponse<T?>>` 인가?
