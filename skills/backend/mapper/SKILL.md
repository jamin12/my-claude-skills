---
name: mapper
description: 매퍼 규칙(MapStruct vs 확장함수, REST/JPA/Application 매퍼 패턴). 매퍼 파일 작성/수정, 도메인-엔티티-DTO 변환 작업 시 참조한다.
---

# 매퍼 규칙

## 두 가지 매퍼 패턴

| 변환 대상 | 패턴 | 이유 |
|-----------|------|------|
| 도메인 모델 관련 (Entity↔Domain, Domain→Result) | **파일 레벨 확장함수** | Domain은 private constructor이므로 create()/restore() 호출 필요 |
| Request→Command | **MapStruct 인터페이스** | 필드명이 동일한 단순 변환에 적합 |
| Result→Response (단순 1:1 매핑) | **MapStruct 인터페이스** | 필드명이 동일한 단순 변환에 적합 |
| Result→Response (필드 조합/가공 필요) | **파일 레벨 확장함수** | 중첩 객체 구성, 타입 변환 등 MapStruct로 표현 어려운 경우 |

## JPA 매퍼 — 확장함수 패턴

위치: `adapter/{도메인}/jpaOut/mapper/`

`toEntity()` 는 엔티티를 생성자로 직접 만들고, `toDomain()` 은 도메인 `restore()` 를 호출한다.
`update(domain)` 확장함수는 작성하지 않는다 — 도메인이 상태 전이를 완결한 객체를 주므로 매퍼는 매번
엔티티 전체를 만들고, 갱신은 JPA `merge` 가 통째로 덮어쓴다.

```kotlin
// Entity → Domain (restore 호출)
fun CompanyJpaEntity.toDomain(): Company =
    Company.restore(id = CompanyId(this.id), name = this.name, createdAt = this.createdAt)

// Domain → Entity (생성자 직접 호출)
fun Company.toEntity(): CompanyJpaEntity =
    CompanyJpaEntity(id = this.id.value, name = this.name, createdAt = this.createdAt)
```

> 쓰기 빈도가 높아 `PersistableBaseEntity`(insert 시 select 회피)를 도입하면 `toEntity(isNew)` 로 신규 신호를 받는다 — 단 `isNew` 는 **도메인이 아니라 어댑터가** 판정해 넘긴다. `jpa-entity` 스킬 규칙 5 참조.

// WRONG - object 싱글톤 매퍼
```kotlin
object AlertMapper {
    fun toEntity(domain: Alert): AlertEntity = ...
    fun toDomain(entity: AlertEntity): Alert = ...
}
```

## REST 매퍼 — MapStruct + 확장함수 공존

위치: `adapter/{도메인}/restIn/mapper/`

하나의 매퍼 파일에 두 패턴이 공존한다:

```kotlin
// MapStruct (data class → data class: Request → Command, Result → Response)
@Mapper(componentModel = "spring")
interface CompanyRestMapper {
    fun toCommand(request: CompanyRequest): UpsertCompanyCommand
    fun toResponse(result: CompanyResult): CompanyResponse
}
```

다중 파라미터 매핑 시 `@Mapping`으로 소스를 명시:

```kotlin
@Mapper(componentModel = "spring")
interface DepartmentRestMapper {
    @Mapping(source = "id", target = "id")
    fun toUpdateCommand(id: Long, request: UpdateDepartmentRequest): UpdateDepartmentCommand
}
```

## Application 매퍼 — Domain → Result 확장함수

위치: `application/{도메인}/mapper/`

```kotlin
fun Alert.toResult(): AlertResult =
    AlertResult(id = this.id.value, name = this.name)
```

## 매퍼 위치 요약

| 매퍼 종류 | 위치 | 패턴 |
|-----------|------|------|
| Entity ↔ Domain | `adapter/{도메인}/jpaOut/mapper/` | 확장함수 |
| Request → Command | `adapter/{도메인}/restIn/mapper/` | MapStruct |
| Result → Response (단순 1:1) | `adapter/{도메인}/restIn/mapper/` | MapStruct |
| Result → Response (필드 조합/가공) | `adapter/{도메인}/restIn/mapper/` | 확장함수 |
| Domain → Result | `application/{도메인}/mapper/` | 확장함수 |

## 체크리스트
- [ ] 도메인 모델 관련 매핑에 확장함수를 사용하는가?
- [ ] data class 간 변환에 MapStruct를 사용하는가?
- [ ] object 싱글톤 매퍼를 사용하지 않는가?
- [ ] 매퍼가 올바른 패키지에 위치하는가?
- [ ] REST 매퍼 파일에 MapStruct와 확장함수가 공존하는가?
- [ ] JPA 매퍼에 `update(domain)` 확장함수가 없는가? (`toEntity()` + merge)
