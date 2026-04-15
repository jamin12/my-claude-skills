---
name: usecase
description: UseCase 패턴(OutPort만 의존, Result DTO 반환, 오케스트레이션)과 Application DTO(Command/Spec/Result/Query) 파일 분리 규칙. UseCase, Port, DTO 작성 시 참조한다.
---

# UseCase 패턴 & DTO 규칙

## UseCase 핵심 규칙

### 규칙 1: UseCase는 OutPort만 의존

UseCase(Application Layer)는 OutPort 인터페이스에만 의존한다. Repository나 Adapter 구현체를 직접 의존하지 않는다.

// WRONG - Repository 직접 의존
```kotlin
@Service
class CreateAlertUseCase(
    private val alertRepository: AlertJpaRepository,  // 금지!
) : CreateAlertInPort { ... }
```

// CORRECT - OutPort 인터페이스만 의존, Result DTO 반환
```kotlin
@Service
class CreateAlertUseCase(
    private val saveAlertOutPort: SaveAlertOutPort,
) : CreateAlertInPort {
    override fun execute(command: CreateAlertCommand): AlertResult {
        val alert = Alert.create(
            stockCode = command.stockCode,
            targetPrice = command.targetPrice,
        )
        return saveAlertOutPort.save(alert).toResult()
    }
}
```

### 규칙 2: InPort 반환 타입은 Result DTO

- **InPort 반환**: `XxxResult`, `Page<XxxResult>`, `List<XxxResult>` (도메인 모델 반환 금지)
- **OutPort 반환**: 기본적으로 **도메인 모델** 반환. 도메인 모델로 표현 불가 시 `Query` DTO 사용.
- **변환 위치**: UseCase의 `return` 시점에서 `.toResult()` 호출
- **void 연산**: 삭제 등 반환값 없는 경우 `Unit` 사용

### 규칙 3: 도메인 모델이 없는 경우 (간소화 패턴)

DB 저장이 필요 없고, 복잡한 비즈니스 로직이 없는 경우(예: K8S 리소스 단순 생성/조회) Domain 레이어 없이 UseCase에서 직접 Command → OutPort 호출이 가능하다.

```kotlin
@Service
class CreateNamespaceUseCase(
    private val createK8sResourceOutPort: CreateK8sResourceOutPort,
) : CreateNamespaceInPort {
    override fun execute(command: CreateNamespaceCommand): CreateNamespaceResult {
        // Domain 모델 없이 직접 리소스 구성
        val namespace = NamespaceBuilder()
            .withNewMetadata()
                .withName(command.name)
                .addToLabels("managed-by", "ccp")
            .endMetadata()
            .build()

        val created = createK8sResourceOutPort.execute(namespace, k8sUser) as Namespace
        return CreateNamespaceResult(name = created.metadata.name)
    }
}
```

**이 패턴을 사용하는 조건** (모두 충족해야 함):
- DB 저장이 필요 없음
- RBAC/권한 설정이 필요 없음
- 복잡한 비즈니스 로직이 없음
- 단순 외부 리소스 생성/조회만 하는 경우

### 규칙 4: UseCase에 비즈니스 로직 넣지 않기

도메인 모델이 있는 경우, 비즈니스 로직(검증, 계산, 상태 전이)은 Domain Model에 위치. UseCase는 오케스트레이션만 담당.

// CORRECT - Domain Model에 비즈니스 로직, UseCase는 오케스트레이션
```kotlin
@Service
class TriggerAlertUseCase(
    private val findAlertOutPort: FindAlertOutPort,
    private val saveAlertOutPort: SaveAlertOutPort,
) : TriggerAlertInPort {
    override fun execute(alertId: AlertId) {
        val alert = findAlertOutPort.findById(alertId)
        val triggered = alert.trigger()  // 도메인 모델 내부에서 검증+상태변경
        saveAlertOutPort.save(triggered)
    }
}
```

### 규칙 5: 네이밍

- 위치: `application/{도메인}/service/`
- 네이밍: `{동사}{도메인}UseCase` (예: `CreateAlertUseCase`, `FindAlertUseCase`)
- InPort 구현: 반드시 해당 InPort 인터페이스를 implements

---

## Application DTO 규칙

### DTO 분류

| 유형 | 용도 | 네이밍 | 예시 |
|------|------|--------|------|
| Command | 쓰기 요청 (생성/수정/삭제) | `{동사}{도메인}Command` | `CreateAlertCommand` |
| Spec | OutPort에 전달하는 검색/필터 조건 | `{도메인}SearchSpec` | `AlertSearchSpec` |
| Result | InPort에서 반환하는 응답 | `{도메인}Result` | `AlertResult` |
| Query | OutPort에서 도메인 모델로 표현 불가한 반환값 | 필요 시 정의 | 집계, 조인 결과 |

### DTO 파일 분리 규칙

역할별 파일에 관련 클래스를 모아서 작성한다. 클래스마다 개별 파일을 만들지 않는다.

```
application/{도메인}/dto/
├── Command.kt      # 모든 Command data class
├── Spec.kt         # 모든 검색 조건 data class (있는 경우만)
├── Result.kt       # 모든 Result data class (있는 경우만)
└── Query.kt        # OutPort 반환용 (도메인 모델 불가 시, 있는 경우만)
```

- 해당 역할의 DTO가 없으면 파일을 만들지 않는다
- 모든 DTO는 `data class`로 정의

### Adapter DTO와 Application DTO 분리

| 레이어 | DTO 유형 | 위치 |
|--------|---------|------|
| Adapter (REST) | Request / Response | `adapter/{도메인}/restIn/dto/` |
| Application | Command / Query / Result | `application/{도메인}/dto/` |

## 체크리스트
- [ ] UseCase가 OutPort 인터페이스만 의존하는가?
- [ ] InPort 반환 타입이 Result DTO인가?
- [ ] UseCase는 오케스트레이션만 담당하는가?
- [ ] DTO가 data class인가?
- [ ] 역할별 파일(Command.kt, Result.kt 등)에 모아서 작성했는가?
- [ ] Adapter DTO와 Application DTO가 분리되어 있는가?
