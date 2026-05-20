---
name: jpa-entity
description: JPA 영속성 어댑터 규칙(Entity/Domain 분리, 확장함수 매퍼, OutPort 구현체 패턴). JPA Entity, Repository, Persistence Adapter 작성 시 참조한다.
---

# JPA 영속성 어댑터 규칙

## 규칙 1: 위치
JPA 관련 코드는 `adapter/{도메인}/jpaOut/` 패키지에 위치한다.
- `entity/`: JPA Entity 클래스
- `repository/`: Spring Data JPA Repository 인터페이스
- `mapper/`: Entity ↔ Domain Model 매퍼
- **OutPort 구현체(Persistence Adapter)는 `jpaOut/` 바로 밑**에 둔다. `service/` 같은 하위 폴더를 만들지 않는다 — 어댑터는 비즈니스 서비스가 아니라 외부 의존(DB) 어댑터이며, `jpaOut/` 자체가 이미 그 책임을 가리킨다.

## 규칙 2: Entity는 Domain Model이 아니다

// WRONG - Domain Model에 JPA 어노테이션
```kotlin
// domain/alert/model/Alert.kt
@Entity
@Table(name = "alerts")
class Alert(...)
```

// CORRECT - 분리된 JPA Entity. 도메인은 domain/ 에, 엔티티는 adapter/{도메인}/jpaOut/entity/ 에.

## 규칙 3: comment 속성으로 컬럼/테이블 설명 필수
모든 Entity 클래스와 컬럼에 JPA 표준 `comment` 속성으로 한글 설명을 추가한다.
`org.hibernate.annotations.@Comment`는 Hibernate 7에서 deprecated 되었으므로 사용하지 않는다.

- **테이블**: `@Table(name = "...", comment = "테이블 설명")`
- **컬럼**: `@Column(comment = "컬럼 설명")`

## 규칙 4: Entity 필드는 `var` + `protected set`, 저장은 merge

도메인이 id(UUID v7)를 미리 생성하므로 `@GeneratedValue` 를 쓰지 않는다. 기본형은 **평범한 엔티티 + 단일 save(merge)** 이다.

### 4-1. 필드는 `var` 이되 `protected set`

`val` 로 두면 Hibernate 가 프로퍼티 접근으로 hydration 할 setter 가 없어 IDE 경고 + 런타임 위험이 있다.
`var` 만 두면 외부에서 마음대로 바꿀 수 있다. **`var` + `protected set`** 이면 Hibernate(reflection)는 채우고
외부 코드는 못 바꾼다. 생성자 파라미터를 받아 body 프로퍼티로 초기화하고, 매퍼가 생성자를 직접 호출한다(별도 팩토리 불필요).

```kotlin
@Entity
@Table(name = "alerts", comment = "알림")
class AlertEntity(
    id: UUID,
    name: String,
    createdAt: Instant,
) {
    @Id
    @Column(name = "id", nullable = false, columnDefinition = "UUID", comment = "알림 ID")
    var id: UUID = id
        protected set

    @Column(nullable = false, comment = "알림명")
    var name: String = name
        protected set

    @Column(name = "created_at", nullable = false, comment = "생성 시각")
    var createdAt: Instant = createdAt
        protected set
}
```

### 4-2. 매퍼: `update` 확장함수 금지, `toEntity()`/`toDomain()`

`update(domain)` 확장함수는 **금지**한다 — "어떤 필드가 가변인지"라는 도메인 지식이 영속성 레이어로 누수된다.
도메인이 상태 전이를 완결한 객체를 주므로, 매퍼는 `toEntity()` 로 매번 엔티티 전체를 만든다. 갱신은 merge 가 통째로 덮어쓴다.

```kotlin
fun AlertEntity.toDomain(): Alert =
    Alert.restore(id = AlertId(this.id), name = this.name, createdAt = this.createdAt)

fun Alert.toEntity(): AlertEntity =
    AlertEntity(id = this.id.value, name = this.name, createdAt = this.createdAt)
```

### 4-3. 어댑터 저장: 단일 `save` (merge)

미리 생성한 id 라 `repository.save(...)` 는 merge 로 동작해 **신규(없으면 insert)/갱신(있으면 update)을 자동 처리**한다.
`findById` 분기도, `update` 호출도 필요 없다.

```kotlin
override fun save(alert: Alert): Alert =
    repository.save(alert.toEntity()).toDomain()
```

> insert 시 merge 가 select-before-insert 를 한 번 한다. 쓰기 빈도가 낮으면 무시할 비용이다(이게 기본).

## 규칙 5: 도입하지 않는 것 (재논쟁 방지용 결정 노트)

- **감사 컬럼(createdAt/updatedAt)**: 도입하지 않는다. 현재 엔티티는 생성 시각에 도메인 의미가 있어(`issued_at`/`linked_at`/가입 `created_at`) generic 감사가 중복되거나 비어버린다. 생성 시각이 도메인 의미 없는 **순수 데이터 행** 엔티티가 생기면 그때 Spring JPA Auditing(`@CreatedDate`/`@LastModifiedDate` + 주입 Clock `DateTimeProvider`)으로 `BaseEntity` 도입.
- **신규/갱신 판별(`isNew`/`Persistable`)**: 도입하지 않는다. 단일 `save`(merge)가 신규(insert)/갱신(update)을 자동 처리한다. 도입하면 `isNew` 가 도메인으로 새거나(누수), 단일 save 에선 `existsById` 가 어차피 select 를 해 이점이 없다. 쓰기가 매우 잦아 select-before-insert 가 실측 병목이면 그때 Create/Update OutPort 분리 + `PersistableBaseEntity` 검토.

> 두 패턴의 구현 예시는 맨 아래 [부록](#부록-대안-패턴-현재-미사용-필요-시-참고) 참고.

## 규칙 6: OutPort 구현체 패턴

OutPort 구현체는 `adapter/{도메인}/jpaOut/` 바로 밑에 두고 `{도메인}JpaAdapter` 로 이름 짓는다.
기본은 **단일 `save()`** 를 유지한다 (Create/Update 로 쪼개지 않는다). `@Service` 대신 `@Component` 를 쓴다 — JPA 어댑터는 외부 의존 어댑터이므로 의미가 정확하다.

```kotlin
@Component
class AlertJpaAdapter(
    private val alertRepository: AlertJpaRepository,
) : AlertOutPort {
    override fun save(alert: Alert): Alert =
        alertRepository.save(alert.toEntity()).toDomain()
}
```

## 체크리스트
- [ ] JPA Entity가 adapter/{도메인}/jpaOut/entity/에 있는가?
- [ ] Domain Model에 JPA 어노테이션이 없는가?
- [ ] Entity 필드가 `var` + `protected set` 인가? (`val` 금지 — hydration, public `var` 금지 — 캡슐화)
- [ ] `@CreationTimestamp`/`@Comment` 를 사용하지 않는가? (JPA `comment=` + 필요 시 Spring Auditing)
- [ ] 매퍼에 `update(domain)` 확장함수가 없는가? (`toEntity()` + merge)
- [ ] OutPort 구현체가 단일 `save()` 만 두는가? (`findById` 분기 없이 merge)
- [ ] OutPort 구현체가 adapter/{도메인}/jpaOut/ 바로 밑에 있는가? (service/ 같은 하위 폴더 X)
- [ ] `@Component` 를 사용하는가? (`@Service` 는 application 서비스용)

## 부록: 대안 패턴 (현재 미사용, 필요 시 참고)

규칙 5의 결정대로 지금은 쓰지 않는다. 아래는 도입이 필요해질 때 바로 따라 할 수 있게 남겨둔 구현 예시다.

### A. `BaseEntity` — 감사 시각 (Spring JPA Auditing)

생성 시각이 도메인 의미를 갖지 않는 **순수 데이터 행** 엔티티가 생기면 도입한다. Hibernate `@CreationTimestamp` 대신 Spring Auditing 을 쓰고, 결정론(테스트 시간 고정)을 위해 **주입 Clock 기반 `DateTimeProvider`** 를 제공한다. `created_at` 은 `updatable=false` 라 merge-update 가 덮어쓰지 않는다.

```kotlin
@MappedSuperclass
@EntityListeners(AuditingEntityListener::class)
abstract class BaseEntity {
    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false, comment = "생성 시각")
    var createdAt: Instant? = null
        protected set

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false, comment = "수정 시각")
    var updatedAt: Instant? = null
        protected set
}

@Configuration
@EnableJpaAuditing(dateTimeProviderRef = "auditingDateTimeProvider")
class JpaAuditingConfig(private val clock: Clock) {
    @Bean
    fun auditingDateTimeProvider() = DateTimeProvider { Optional.of(clock.instant()) }
}
```

### B. `PersistableBaseEntity` — insert 시 select 회피

쓰기 빈도가 매우 높아 merge 의 select-before-insert 가 실측 병목일 때만. `isNew` 는 **도메인이 아니라 어댑터/매퍼 경계**에서 판정한다(존재 이유는 규칙 5 참고).

```kotlin
@MappedSuperclass
abstract class PersistableBaseEntity<T : Any> : Persistable<T> {
    protected abstract val entityId: T   // Kotlin val id 와 Persistable getId() 충돌 회피
    override fun getId(): T = entityId

    @Transient private var isNewFlag = false
    protected fun markAsNew() { isNewFlag = true }

    @PostLoad @PostPersist
    private fun markAsPersisted() { isNewFlag = false }

    override fun isNew() = isNewFlag
}

// 매퍼: isNew 는 어댑터가 넘긴 값. 어댑터(단일 save)는 existsById 로 판정하거나,
// 이점을 살리려면 Create/Update OutPort 를 분리한다.
fun Alert.toEntity(isNew: Boolean): AlertEntity =
    AlertEntity.create(id = this.id.value, name = this.name, isNew = isNew)
```
