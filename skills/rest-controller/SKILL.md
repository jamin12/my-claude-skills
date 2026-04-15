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

// WRONG - Application DTO를 Controller에서 직접 사용
```kotlin
@PostMapping("/alerts")
fun createAlert(@RequestBody command: CreateAlertCommand): CreateAlertResult {
    return createAlertInPort.execute(command)
}
```

// CORRECT - Adapter DTO로 변환
```kotlin
@PostMapping("/alerts")
fun createAlert(@RequestBody request: CreateAlertRequest): CreateAlertResponse {
    val command = request.toCommand()
    val result = createAlertInPort.execute(command)
    return CreateAlertResponse.from(result)
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
fun CreateTektonResourceResult.toCreateResponse(): CreateTektonResourceResponse =
    CreateTektonResourceResponse(
        kind = kind,
        success = success,
        gitOpsDetail = syncSuccess?.let { GitOpsDetail(syncSuccess = it, path = path) },
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
