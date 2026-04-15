---
name: domain-model
description: 도메인 모델 규칙(Private constructor, Factory method, 불변성)과 Value Object(@JvmInline value class) 작성 규칙. 도메인 모델 생성/수정 시 참조한다.
---

# 도메인 모델 & Value Object 규칙

## 규칙 1: Private Constructor + Factory Method

도메인 모델은 반드시 private constructor를 사용하고, companion object에 factory method를 제공한다.

- `create()`: 새로운 엔티티 생성 (id 없음)
- `restore()`: DB에서 복원 (id 있음)

// WRONG - public constructor 직접 노출
```kotlin
class Alert(
    val id: AlertId? = null,
    val name: String,
    val price: BigDecimal,
)
```

// CORRECT - private constructor + factory
```kotlin
class Alert private constructor(
    val id: AlertId? = null,
    val name: String,
    val price: BigDecimal,
) {
    companion object {
        fun create(name: String, price: BigDecimal): Alert =
            Alert(name = name, price = price)

        fun restore(id: AlertId, name: String, price: BigDecimal): Alert =
            Alert(id = id, name = name, price = price)
    }
}
```

## 규칙 2: 불변성 우선

- `val` 사용이 기본. `var`는 도메인 로직에 의해 변경이 필요한 경우만 허용.
- 상태 변경은 도메인 메서드를 통해서만 수행.

### val만 사용하는 경우 — 새 객체 반환
모든 필드가 불변이면 상태 변경 시 새 객체를 생성하여 반환한다.

```kotlin
class Alert private constructor(
    val id: AlertId? = null,
    val status: AlertStatus = AlertStatus.ACTIVE,
) {
    fun trigger(): Alert = Alert(
        id = this.id,
        status = AlertStatus.TRIGGERED,
    )
    companion object { ... }
}
```

### var를 사용하는 경우 — private set + 도메인 메서드
변경이 필요한 필드는 constructor에 일반 파라미터로 받고, 클래스 body에 `var ... private set`으로 선언한다. 외부에서는 도메인 메서드를 통해서만 변경 가능하다.

```kotlin
class Member private constructor(
    val id: MemberId,
    val name: String? = null,
    giteaApiToken: String?,       // val/var 없이 일반 파라미터로 받음
    deleted: Boolean = false,     // val/var 없이 일반 파라미터로 받음
    var updatedAt: ZonedDateTime? = null,
) {
    var deleted: Boolean = deleted
        private set                // 외부 직접 변경 금지

    var giteaApiToken: String? = giteaApiToken
        private set

    fun update(giteaApiToken: String? = null) {
        this.giteaApiToken = giteaApiToken
        this.updatedAt = ZonedDateTime.now()
    }

    fun markDeleted() {
        if (deleted) return
        deleted = true
        updatedAt = ZonedDateTime.now()
    }

    companion object { ... }
}
```

// WRONG - constructor에 var로 직접 선언 (외부 변경 가능)
```kotlin
class Member private constructor(
    var deleted: Boolean = false,  // 금지! private set 없이 외부에서 변경 가능
)
```

## 규칙 3: 비즈니스 로직은 도메인 모델 안에

도메인 관련 검증, 계산, 상태 전이 로직은 도메인 모델 내부에 위치한다.

```kotlin
class Alert private constructor(...) {
    init {
        require(price > BigDecimal.ZERO) { "가격은 0보다 커야 합니다" }
    }
    companion object {
        fun create(name: String, price: BigDecimal): Alert =
            Alert(name = name, price = price)  // init 블록에서 검증
    }
}
```

## 규칙 4: Spring/JPA 어노테이션 금지

도메인 모델은 순수 Kotlin 클래스여야 한다. `@Entity`, `@Component` 등 금지.

---

## Value Object 규칙

### 도메인 개념은 Value Object로 래핑

원시 타입(Long, String) 대신 도메인 의미를 가진 VO를 사용한다.

```kotlin
// domain/alert/vo/AlertId.kt
@JvmInline
value class AlertId(val value: Long)

// domain/alert/vo/StockCode.kt
@JvmInline
value class StockCode(val value: String) {
    init {
        require(value.matches(Regex("^[0-9]{6}$"))) {
            "종목코드는 6자리 숫자여야 합니다"
        }
    }
}
```

### VO 규칙 요약

- **위치**: `domain/{도메인}/vo/` 패키지
- **단일 값 VO**: 반드시 `@JvmInline value class` 사용 (data class 금지)
- **검증**: VO 생성 시점에 `init` 블록으로 유효성 보장

## 체크리스트
- [ ] private constructor를 사용하는가?
- [ ] create()와 restore() factory method가 있는가?
- [ ] val을 우선 사용하는가?
- [ ] 비즈니스 검증 로직이 도메인 모델 안에 있는가?
- [ ] Spring/JPA 어노테이션이 없는가?
- [ ] ID 타입이 @JvmInline value class VO로 래핑되어 있는가?
- [ ] VO가 domain/{도메인}/vo/ 패키지에 있는가?
