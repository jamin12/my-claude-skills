---
name: testing
description: Kotest BehaviorSpec 테스트 작성 규칙(Given/When/Then)과 모킹 전략(OutPort만 모킹, MockK 사용), HTTP 테스트 파일 규칙. 테스트 코드 작성/수정 시 참조한다.
---

# Kotest BehaviorSpec & 모킹 전략 규칙

## 규칙 1: 항상 BehaviorSpec 사용

모든 테스트는 반드시 Kotest의 BehaviorSpec을 사용한다. FunSpec, StringSpec, DescribeSpec, JUnit 등 다른 스타일 금지.

// WRONG - JUnit 스타일
```kotlin
@Test
fun `프로젝트를 생성한다`() {
    val result = useCase.execute(command)
    assertEquals(expected, result)
}
```

// CORRECT - Kotest BehaviorSpec
```kotlin
class CreateAlertUseCaseTest : BehaviorSpec() {
    init {
        Given("유효한 알림 생성 요청이 주어졌을 때") {
            val command = CreateAlertCommand(name = "삼성전자", price = BigDecimal("70000"))

            When("UseCase를 실행하면") {
                val result = useCase.execute(command)

                Then("알림이 생성된다") {
                    result.name shouldBe "삼성전자"
                }
            }
        }
    }
}
```

## 규칙 2: Spring 통합 테스트 설정

```kotlin
@SpringBootTest
@ActiveProfiles("test")
class CreateAlertUseCaseTest : BehaviorSpec() {
    override fun extensions() = listOf(SpringExtension)

    init {
        // 테스트 코드
    }
}
```

필수 요소:
- `@SpringBootTest` 어노테이션
- `@ActiveProfiles("test")` 어노테이션
- `override fun extensions() = listOf(SpringExtension)`
- 테스트 코드는 `init {}` 블록 안에 작성

## 규칙 3: 테스트 데이터는 Instancio 사용

반복적인 테스트 데이터 생성에는 Instancio를 사용한다.

---

## 모킹 전략

### OutPort만 모킹

UseCase 테스트 시 OutPort 인터페이스만 모킹한다. Repository나 Adapter 구현체를 직접 모킹하지 않는다.

// WRONG - Repository 직접 모킹
```kotlin
val repository = mockk<AlertJpaRepository>()  // 금지!
```

// CORRECT - OutPort 인터페이스만 모킹
```kotlin
val saveAlertOutPort = mockk<SaveAlertOutPort>()
val useCase = CreateAlertUseCase(saveAlertOutPort)
```

### MockK 사용

Mockito 대신 MockK를 사용한다.

// WRONG - Mockito 사용
```kotlin
@Mock lateinit var outPort: SaveAlertOutPort
@InjectMocks lateinit var useCase: CreateAlertUseCase
```

// CORRECT - MockK 사용
```kotlin
val outPort = mockk<SaveAlertOutPort>()
val useCase = CreateAlertUseCase(outPort)

every { outPort.execute(any()) } returns expected
verify(exactly = 1) { outPort.execute(any()) }
```

### 전체 테스트 패턴

```kotlin
@SpringBootTest
@ActiveProfiles("test")
class CreateAlertUseCaseTest : BehaviorSpec() {
    override fun extensions() = listOf(SpringExtension)

    init {
        val saveAlertOutPort = mockk<SaveAlertOutPort>()
        val useCase = CreateAlertUseCase(saveAlertOutPort)

        Given("유효한 알림 생성 요청이 주어졌을 때") {
            val command = CreateAlertCommand(
                stockCode = StockCode("005930"),
                targetPrice = Money(BigDecimal("70000")),
            )
            val expected = Alert.create(
                stockCode = StockCode("005930"),
                targetPrice = Money(BigDecimal("70000")),
            )

            every { saveAlertOutPort.execute(any()) } returns expected

            When("UseCase를 실행하면") {
                val result = useCase.execute(command)

                Then("알림이 저장되어 반환된다") {
                    result shouldBe expected
                    verify(exactly = 1) { saveAlertOutPort.execute(any()) }
                }
            }
        }
    }
}
```

---

## HTTP 테스트 파일 (.http)

### 규칙: 새 API 추가 시 .http 파일도 함께 추가

API 수동 테스트용 `.http` 파일을 해당 도메인의 `.http` 파일에 추가한다.

### 위치

```
{모듈}/src/test/resources/http/{도메인}/{파일명}.http
```

### 구조

```http
@baseUrl = http://localhost:8080/{모듈-context-path}/api
@token = Bearer {JWT 토큰}

### ===== {섹션명} =====

### {API 설명}
POST {{baseUrl}}/v1/{path}
Authorization: {{token}}
Content-Type: application/json

{
  "field": "value"
}

### {조회 API 설명}
GET {{baseUrl}}/v1/{path}?param=value
Authorization: {{token}}
```

### 규칙
- 파일 상단에 `@baseUrl`, `@token` 등 공통 변수 선언
- 도메인별 폴더로 구분하여 관리 (예: `http/argo/`, `http/namespace/`)
- 기존 도메인 폴더에 `.http` 파일이 있으면 해당 파일에 추가
- 각 요청 앞에 `###`으로 구분하고 설명 추가
- `###` 구분선과 섹션명으로 API 그룹핑

### 예시

```http
@baseUrl = http://localhost:8080/kube-management/api
@token = Bearer eyJ...

### ===== Storage GitOps 생성 =====

### ConfigMap GitOps 생성
POST {{baseUrl}}/v1/storages/cicd
Authorization: {{token}}
Content-Type: application/json

{
  "type": "CONFIG_MAP",
  "yaml": "apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: my-config\n",
  "argocdLabel": "my-argocd-app",
  "path": "storage/configmaps"
}
```

---

## 체크리스트

### 단위 테스트 (Kotest)
- [ ] BehaviorSpec을 상속하는가?
- [ ] Given/When/Then 구조를 따르는가?
- [ ] Spring 테스트에 SpringExtension이 있는가?
- [ ] @ActiveProfiles("test")가 있는가?
- [ ] OutPort 인터페이스만 모킹하는가?
- [ ] MockK를 사용하는가? (Mockito 아님)

### HTTP 테스트 파일
- [ ] 새 API에 대한 .http 테스트가 추가되었는가?
- [ ] 기존 도메인 .http 파일에 추가했는가? (신규 파일 생성 지양)
- [ ] 공통 변수(@baseUrl, @token)를 사용하는가?
