---
name: jpa-entity
description: JPA 영속성 어댑터 규칙(Entity/Domain 분리, 확장함수 매퍼, OutPort 구현체 패턴). JPA Entity, Repository, Persistence Adapter 작성 시 참조한다.
---

# JPA 영속성 어댑터 규칙

## 규칙 1: 위치
JPA 관련 코드는 `adapter/{도메인}/jpaOut/` 패키지에 위치한다.
- `entity/`: JPA Entity 클래스
- `repository/`: Spring Data JPA Repository 인터페이스
- `service/`: OutPort 구현체 (Persistence Adapter)
- `mapper/`: Entity ↔ Domain Model 매퍼

## 규칙 2: Entity는 Domain Model이 아니다

// WRONG - Domain Model에 JPA 어노테이션
```kotlin
// domain/alert/model/Alert.kt
@Entity
@Table(name = "alerts")
class Alert(
    @Id @GeneratedValue val id: Long,
    @Column val name: String,
)
```

// CORRECT - 분리된 JPA Entity + comment 속성으로 컬럼 설명
```kotlin
// adapter/alert/jpaOut/entity/AlertEntity.kt
@Entity
@Table(name = "alerts", comment = "알림")
class AlertEntity(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(comment = "알림 ID")
    val id: Long = 0,

    @Column(nullable = false, comment = "알림명")
    val name: String,

    @Column(nullable = false, comment = "목표 가격")
    val targetPrice: BigDecimal,
)
```

## 규칙 3: comment 속성으로 컬럼/테이블 설명 필수
모든 Entity 클래스와 컬럼에 JPA 표준 `comment` 속성으로 한글 설명을 추가한다.
`org.hibernate.annotations.@Comment`는 Hibernate 7에서 deprecated 되었으므로 사용하지 않는다.

- **테이블**: `@Table(name = "...", comment = "테이블 설명")`
- **컬럼**: `@Column(comment = "컬럼 설명")`

## 규칙 4: Entity ↔ Domain Model 매핑 — 확장함수 패턴

매퍼는 **object 싱글톤이 아닌 파일 레벨 확장함수**로 작성한다.

// WRONG - object 싱글톤 매퍼
```kotlin
object AlertMapper {
    fun toEntity(domain: Alert): AlertEntity = ...
    fun toDomain(entity: AlertEntity): Alert = ...
}
```

// CORRECT - 확장함수 매퍼
```kotlin
// adapter/alert/jpaOut/mapper/AlertJpaMapper.kt

// Entity → Domain (restore 호출)
fun AlertEntity.toDomain(): Alert =
    Alert.restore(
        id = AlertId(this.id),
        name = this.name,
        targetPrice = Money(this.targetPrice),
    )

// Domain → Entity
fun Alert.toEntity(): AlertEntity =
    AlertEntity(
        name = this.name,
        targetPrice = this.targetPrice.value,
    )

// Entity 업데이트 (기존 엔티티에 도메인 값 반영)
fun AlertEntity.update(domain: Alert): AlertEntity {
    this.name = domain.name
    this.targetPrice = domain.targetPrice.value
    return this
}
```

## 규칙 5: OutPort 구현체 패턴

```kotlin
// adapter/alert/jpaOut/service/AlertPersistenceAdapter.kt
@Service
class AlertPersistenceAdapter(
    private val alertRepository: AlertJpaRepository,
) : SaveAlertOutPort, FindAlertOutPort {

    override fun save(alert: Alert): Alert {
        val entity = alert.toEntity()
        val saved = alertRepository.save(entity)
        return saved.toDomain()
    }
}
```

## 체크리스트
- [ ] JPA Entity가 adapter/{도메인}/jpaOut/entity/에 있는가?
- [ ] Domain Model에 JPA 어노테이션이 없는가?
- [ ] Entity ↔ Domain 매퍼가 확장함수로 작성되었는가?
- [ ] OutPort 구현체가 adapter/{도메인}/jpaOut/service/에 있는가?
- [ ] OutPort 인터페이스를 구현하는가?
